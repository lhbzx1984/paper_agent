import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  generateChatCompletionStream,
  requireLLMClient,
} from "@/lib/llm/openai";
import {
  maybeAutoRunPythonAppend,
  streamDataLabWithE2bTools,
} from "@/lib/llm/data-lab-e2b-tools";
import { resolveE2bApiKey } from "@/lib/e2b/resolve-api-key";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export const runtime = "nodejs";
export const maxDuration = 300;

const SYSTEM_PROMPT_BASE = `你是「数据与实验分析」科研助手，帮助用户完成与数据、统计与实验设计相关的讨论与方案梳理。

你可以协助的方向包括但不限于：
- 实验设计：变量、对照组、随机化、重复与样本量、统计功效的定性说明
- 统计方法：描述性统计、假设检验、方差分析、回归、非参数方法等的选型与结果解读要点
- 数据问题：缺失值、异常值、数据清洗与变换的思路
- 可视化：常用图表类型选择与阅读要点
- 工具：在需要时可给出 Python / R 的示例代码片段（注明假设与注意事项）；若用户提供了「论文实验与验证设计方案」，应优先据此进行模块划分、接口设计与实现草稿
- 若系统已启用 Python 执行工具，可在适当时机调用工具 execute_python 实际运行 Python 并基于输出回答用户

回答要求：
- 使用清晰、严谨的中文；必要时分步骤说明。
- 若关键信息不足（如研究问题、设计类型、变量类型），先简要追问再作答。
- 不编造原始数据或具体 p 值；提醒用户以实际数据与专业判断为准。
- 未通过 execute_python 工具或本地真实执行时，禁止用「执行结果：」「输出：」等形式**假装**代码已运行；只能提供代码供用户自行运行，并明确说明尚未执行。
- 涉及临床、法律、伦理或高风险决策时，提醒用户咨询领域专家或合规要求。
- 当用户从文献分析导入「论文实验与验证设计方案」时，应优先遵循该方案中的任务设定、指标与步骤来协助代码设计；若代码实现与方案冲突，先说明差异再给出修改建议。
- 用户可能在消息中附带「用户上传的 CSV 文件」及以 \`\`\`csv 包裹的表格正文，请将其视为当前数据依据进行分析、统计建议或代码示例（若需执行代码，可结合 execute_python）。`;

function sse(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

function normalizeMessages(raw: unknown): ChatMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMsg[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: string }).role;
    const content = String((item as { content?: unknown }).content ?? "").trim();
    if (!content) continue;
    if (role === "user" || role === "assistant") {
      out.push({ role, content: content.slice(0, 48000) });
    }
  }
  return out.slice(-24);
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let aborted = false;
      req.signal?.addEventListener("abort", () => {
        aborted = true;
        try {
          controller.close();
        } catch {
          /* noop */
        }
      });

      const send = (data: object) => {
        if (aborted) return;
        try {
          controller.enqueue(encoder.encode(sse(data)));
        } catch {
          /* noop */
        }
      };

      try {
        const body = await req.json().catch(() => ({}));
        const {
          messages: rawMessages,
          model: bodyModel,
          schemeContext,
          enablePythonExecutionTool: bodyEnablePyTool,
          enableE2bPythonTools: bodyLegacyE2b,
        } = body as {
          messages?: unknown;
          model?: string;
          /** 从文献分析导入的「论文实验与验证设计方案」全文，注入 system */
          schemeContext?: string;
          /** 默认 true；为 false 时不注册 execute_python、不注入执行说明 */
          enablePythonExecutionTool?: boolean;
          /** @deprecated 与 enablePythonExecutionTool 同义，保留兼容旧客户端 */
          enableE2bPythonTools?: boolean;
        };

        const enablePythonExecutionTool =
          bodyEnablePyTool !== false && bodyLegacyE2b !== false;

        const messages = normalizeMessages(rawMessages);
        if (messages.length === 0) {
          send({ type: "error", error: "请至少发送一条有效用户消息" });
          controller.close();
          return;
        }
        if (messages[messages.length - 1]?.role !== "user") {
          send({ type: "error", error: "最后一条消息须为用户" });
          controller.close();
          return;
        }

        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          send({ type: "error", error: "Unauthorized" });
          controller.close();
          return;
        }

        let model = bodyModel?.trim() || "";
        const { data: settingsRow } = await supabase
          .from("user_llm_settings")
          .select("settings")
          .eq("user_id", user.id)
          .single();
        const raw = (settingsRow?.settings as Record<string, LLMModuleConfig>) ?? {};
        const mod = raw.data_lab;
        let llmConfig: {
          apiKey?: string;
          baseURL?: string;
          model?: string;
        } = {};
        if (mod && (mod.api_key || mod.base_url || mod.model)) {
          const resolvedModel =
            model ||
            (typeof mod.model === "string" ? mod.model.trim() : "") ||
            "";
          llmConfig = {
            apiKey: mod.api_key || undefined,
            baseURL: mod.base_url || undefined,
            model: resolvedModel || undefined,
          };
        } else if (model) {
          llmConfig = { model };
        }
        model = llmConfig.model?.trim() || "";

        if (!llmConfig.apiKey || !llmConfig.baseURL || !model) {
          send({
            type: "error",
            error:
              "请先在「大模型设置」中为「数据实验分析」配置 base_url、api_key 和 model",
          });
          controller.close();
          return;
        }

        const e2bKey = await resolveE2bApiKey(supabase, user.id);
        const usePythonExecutionTool = !!e2bKey && enablePythonExecutionTool;

        const scheme = schemeContext?.trim().slice(0, 16000);
        let systemBody = SYSTEM_PROMPT_BASE;
        if (usePythonExecutionTool) {
          systemBody +=
            "\n\n【Python 执行工具 execute_python】当用户要求运行、执行、验证代码或需要数值/图表结果时，必须先调用工具 execute_python（参数 code 为完整可执行源码），再根据工具返回的真实 stdout/stderr 与 execution 结果回答；禁止在未调用该工具时编造「执行结果」或终端输出。" +
            "\n若你未调用工具，服务端会尝试从回复中的 ```python 代码块（或无围栏但以 import/from 开头的连续代码）自动执行；为可靠触发请始终用 ```python 包裹可运行代码。" +
            "\n图表：matplotlib 等会在工具返回的 results 中含图像信息（如 hasPng）；向用户说明图表已生成及指标含义；当前对话界面通常无法嵌入图片，勿声称「已显示图」除非工具结果中确有图表数据。";
        }
        const systemContent = scheme
          ? `${systemBody}\n\n【用户提供的论文实验与验证设计方案】（优先遵循）\n${scheme}`
          : systemBody;

        const apiMessages: {
          role: "system" | "user" | "assistant";
          content: string;
        }[] = [
          { role: "system", content: systemContent },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        send({ type: "start" });

        if (usePythonExecutionTool) {
          try {
            const client = requireLLMClient({
              apiKey: llmConfig.apiKey,
              baseURL: llmConfig.baseURL,
            });
            await streamDataLabWithE2bTools({
              client,
              model,
              messages: apiMessages,
              e2bKey: e2bKey!,
              userId: user.id,
              send: (data) => send(data),
              isAborted: () => aborted,
              autoRunExtractedPython: enablePythonExecutionTool,
            });
          } catch (toolErr) {
            let full = "";
            for await (const chunk of generateChatCompletionStream({
              messages: apiMessages,
              model,
              apiKey: llmConfig.apiKey,
              baseURL: llmConfig.baseURL,
            })) {
              if (aborted) break;
              full += chunk;
              send({ type: "chunk", text: chunk });
            }
            if (!aborted) {
              let finalContent = full;
              if (enablePythonExecutionTool && e2bKey) {
                const extra = await maybeAutoRunPythonAppend({
                  assistantMarkdown: full,
                  e2bKey,
                  userId: user.id,
                  send: (data) => send(data),
                  isAborted: () => aborted,
                });
                if (extra) finalContent += extra;
              }
              send({ type: "done", content: finalContent });
            }
          }
        } else {
          let full = "";
          for await (const chunk of generateChatCompletionStream({
            messages: apiMessages,
            model,
            apiKey: llmConfig.apiKey,
            baseURL: llmConfig.baseURL,
          })) {
            if (aborted) break;
            full += chunk;
            send({ type: "chunk", text: chunk });
          }
          if (!aborted) {
            send({ type: "done", content: full });
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "生成失败";
        send({ type: "error", error: msg });
      } finally {
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
