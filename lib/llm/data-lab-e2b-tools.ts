import OpenAI from "openai";
import { executePythonInE2bSandbox } from "@/lib/e2b/execute-python";
import { preparePythonCodeForSandbox } from "@/lib/e2b/prepare-python-code";
import { extractFirstPythonBlock } from "@/lib/data-lab/extract-python-block";
import { formatSandboxAppendFromToolJson } from "@/lib/e2b/format-tool-output";

const MAX_ROUNDS = 5;
const MIN_CODE_LEN = 8;

/** 非 token 流场景下将长文本切成 chunk（如自动执行 Python 后的结果附录） */
function streamChunks(
  text: string,
  send: (data: Record<string, unknown>) => void,
  isAborted: () => boolean,
) {
  for (let i = 0; i < text.length; i += 40) {
    if (isAborted()) return;
    send({ type: "chunk", text: text.slice(i, i + 40) });
  }
}

type ToolCallAcc = { id: string; name: string; arguments: string };

/**
 * 流式一轮对话（支持 tool_calls 分片累积）；将模型正文的 delta.content 实时转发为 SSE chunk。
 */
async function streamOneChatRound(opts: {
  client: OpenAI;
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  send: (data: Record<string, unknown>) => void;
  isAborted: () => boolean;
}): Promise<
  | { ok: true; message: OpenAI.Chat.ChatCompletionMessage }
  | { ok: false; error: string }
> {
  const { client, model, messages, tools, send, isAborted } = opts;

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      stream: true,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "模型请求失败",
    };
  }

  let text = "";
  const toolCallAcc = new Map<number, ToolCallAcc>();

  try {
    for await (const chunk of stream) {
      if (isAborted()) return { ok: false, error: "aborted" };
      const choice = chunk.choices[0];
      if (!choice?.delta) continue;
      const delta = choice.delta;

      const piece = delta.content ?? "";
      if (piece) {
        text += piece;
        send({ type: "chunk", text: piece });
      }

      if (delta.tool_calls?.length) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          let acc = toolCallAcc.get(idx);
          if (!acc) {
            acc = { id: "", name: "", arguments: "" };
            toolCallAcc.set(idx, acc);
          }
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "模型流式输出中断",
    };
  }

  const sorted = [...toolCallAcc.entries()].sort((a, b) => a[0] - b[0]);
  const tool_calls: OpenAI.Chat.ChatCompletionMessageToolCall[] = sorted.map(
    ([, acc]) => ({
      id: acc.id || `call_${crypto.randomUUID()}`,
      type: "function" as const,
      function: {
        name: acc.name,
        arguments: acc.arguments,
      },
    }),
  );

  if (tool_calls.length > 0) {
    return {
      ok: true,
      message: {
        role: "assistant",
        content: text || null,
        tool_calls,
        refusal: null,
      },
    };
  }

  return {
    ok: true,
    message: {
      role: "assistant",
      content: text,
      refusal: null,
    },
  };
}

/**
 * 当模型未调用工具但回复中含 ```python 块时，提取并在云端执行，将结果以 chunk 追加并返回追加文本（供 done）。
 */
export async function maybeAutoRunPythonAppend(opts: {
  assistantMarkdown: string;
  e2bKey: string;
  userId: string;
  send: (data: Record<string, unknown>) => void;
  isAborted: () => boolean;
}): Promise<string | null> {
  const block = extractFirstPythonBlock(opts.assistantMarkdown);
  if (!block || block.trim().length < MIN_CODE_LEN) return null;

  const code = preparePythonCodeForSandbox(block);
  const result = await executePythonInE2bSandbox({
    code,
    apiKey: opts.e2bKey,
    userId: opts.userId,
  });
  if (opts.isAborted()) return null;

  if (result.imageArtifacts?.length) {
    for (const img of result.imageArtifacts) {
      if (opts.isAborted()) return null;
      opts.send({
        type: "artifact",
        kind: "image",
        mime: img.mime,
        base64: img.base64,
      });
    }
  }

  const append = formatSandboxAppendFromToolJson(result.toolContent);
  const extra = `\n\n---\n**Python 执行结果**\n\`\`\`\n${append}\n\`\`\`\n`;
  streamChunks(extra, opts.send, opts.isAborted);
  if (opts.isAborted()) return null;
  return extra;
}

/**
 * 使用 OpenAI Chat Completions 的 function calling，通过 execute_python 工具执行 Python；
 * 最终将模型回复以伪流式 chunk 发给前端（与无工具路径的 SSE 形状一致）。
 */
export async function streamDataLabWithE2bTools(opts: {
  client: OpenAI;
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  e2bKey: string;
  userId: string;
  send: (data: Record<string, unknown>) => void;
  isAborted: () => boolean;
  /** 为 true 且本轮未调用 execute_python 时，从纯文本回复中提取 ```python 并自动执行 */
  autoRunExtractedPython?: boolean;
}): Promise<void> {
  const { client, model, e2bKey, userId, send, isAborted } = opts;
  const autoRunExtractedPython = opts.autoRunExtractedPython !== false;
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [...opts.messages];

  let executePythonToolUsed = false;
  /** 本轮对话中最近一次 execute_python 传入的源码，用于在最终正文中展示（模型总结里常省略代码） */
  let lastExecutedPythonCode: string | null = null;

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "execute_python",
        description:
          "在隔离的云端 Python 环境中执行代码，返回 stdout/stderr、解释器文本结果与图表等信息。传入完整、可执行的 Python 源码（单 cell）。",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "完整 Python 源代码",
            },
          },
          required: ["code"],
        },
      },
    },
  ];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (isAborted()) return;

    const roundRes = await streamOneChatRound({
      client,
      model,
      messages: msgs,
      tools,
      send,
      isAborted,
    });
    if (!roundRes.ok) {
      if (roundRes.error === "aborted") return;
      send({ type: "error", error: roundRes.error });
      return;
    }

    const am = roundRes.message;
    if (!am.tool_calls?.length) {
      const text = typeof am.content === "string" ? am.content : "";
      let codePreamble = "";
      if (
        executePythonToolUsed &&
        lastExecutedPythonCode &&
        lastExecutedPythonCode.trim().length >= MIN_CODE_LEN
      ) {
        const raw = lastExecutedPythonCode.trim();
        const hint = raw.slice(0, Math.min(80, raw.length));
        const alreadyInReply =
          text.includes(hint) ||
          (text.includes("```") && text.includes(raw.split("\n")[0]?.trim() ?? ""));
        if (!alreadyInReply) {
          codePreamble = `### 本次执行的代码\n\n\`\`\`python\n${lastExecutedPythonCode.trim()}\n\`\`\`\n\n`;
        }
      }
      /** 正文已在流式阶段以 chunk 下发；codePreamble 仅并入 done，避免与流式顺序冲突 */
      let finalContent = codePreamble + text;
      if (autoRunExtractedPython && !executePythonToolUsed) {
        const extra = await maybeAutoRunPythonAppend({
          assistantMarkdown: text,
          e2bKey,
          userId,
          send,
          isAborted,
        });
        if (extra) finalContent += extra;
      }
      if (!isAborted()) send({ type: "done", content: finalContent });
      return;
    }

    msgs.push(am);

    for (const tc of am.tool_calls) {
      if (isAborted()) return;
      if (tc.type !== "function") continue;
      let out: string;
      if (tc.function.name === "execute_python") {
        executePythonToolUsed = true;
        let args: { code?: string } = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}") as { code?: string };
        } catch {
          /* noop */
        }
        const raw = typeof args.code === "string" ? args.code : "";
        lastExecutedPythonCode = raw;
        const code = preparePythonCodeForSandbox(raw);
        const result = await executePythonInE2bSandbox({
          code,
          apiKey: e2bKey,
          userId,
        });
        out = result.toolContent;
        if (result.imageArtifacts?.length) {
          for (const img of result.imageArtifacts) {
            if (isAborted()) return;
            send({
              type: "artifact",
              kind: "image",
              mime: img.mime,
              base64: img.base64,
            });
          }
        }
      } else {
        out = JSON.stringify({
          error: "unknown_tool",
          name: tc.function.name,
        });
      }
      msgs.push({
        role: "tool",
        tool_call_id: tc.id,
        content: out,
      });
    }
  }

  send({ type: "error", error: "工具调用轮数过多，请简化请求" });
}
