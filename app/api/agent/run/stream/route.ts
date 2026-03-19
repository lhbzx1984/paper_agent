import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { listSkills } from "@/lib/skills/registry";
import { DEFAULT_CHAT_MODEL } from "@/lib/llm/openai";
import { generateText, generateTextStream } from "@/lib/llm/openai";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";
import {
  executeTopicGenerate,
  executeTopicGenerateStream,
} from "@/skills/topic-generate";
import {
  executeKeywordSkill,
  executeKeywordSkillStream,
} from "@/skills/keywords";
import { searchSimilarChunks } from "@/lib/vector/pgvector";
import { embedText } from "@/lib/llm/openai";
import { executeSkill } from "@/lib/skills/registry";

export const runtime = "nodejs";
export const maxDuration = 900;

function sse(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
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
          /* already closed */
        }
      });

      const send = (data: object) => {
        if (aborted) return;
        try {
          controller.enqueue(encoder.encode(sse(data)));
        } catch {
          /* stream closed */
        }
      };

      try {
        // SSE 注释行，促发首字节刷新，避免代理/浏览器缓冲
        send({ type: "progress", step: "init" });
        if (aborted) return;
        const body = await req.json();
        const {
          input,
          projectId,
          model: bodyModel,
          skillIds = [],
        } = body as {
          input?: string;
          projectId?: string;
          model?: string;
          skillIds?: string[];
        };

        if (!input?.trim()) {
          send({ type: "error", error: "input is required" });
          controller.close();
          return;
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        let model = bodyModel;
        let llmConfig: { apiKey?: string; baseURL?: string; model: string } = {
          model: model ?? DEFAULT_CHAT_MODEL,
        };
        if (user) {
          const { data: settingsRow } = await supabase
            .from("user_llm_settings")
            .select("settings")
            .eq("user_id", user.id)
            .single();
          const raw = (settingsRow?.settings as Record<string, LLMModuleConfig>) ?? {};
          const mod = raw.workspace;
          if (mod && (mod.api_key || mod.base_url || mod.model)) {
            llmConfig = {
              apiKey: mod.api_key || undefined,
              baseURL: mod.base_url || undefined,
              model: model || mod.model || DEFAULT_CHAT_MODEL,
            };
          } else if (model) {
            llmConfig = { model };
          }
        }
        model = llmConfig.model;

        // 立即发送确认，让前端知道请求已收到
        send({ type: "progress", step: "topic" });

        const builtinIds = new Set(listSkills().map((s) => s.id));
        const customIds = skillIds.filter((id: string) => !builtinIds.has(id));

        let customSkillsMap: Record<
          string,
          { system_prompt: string; prompt_template: string }
        > = {};
        if (customIds.length > 0) {
          const supabase = await createClient();
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const { data: skillsData } = await supabase
              .from("custom_skills")
              .select("id, system_prompt, prompt_template")
              .eq("user_id", userData.user.id)
              .in("id", customIds);
            for (const s of skillsData ?? []) {
              customSkillsMap[s.id] = {
                system_prompt: s.system_prompt,
                prompt_template: s.prompt_template,
              };
            }
          }
        }

        const BUILTIN_CORE = ["topic-generate", "keywords"];
        let skillContext = "";
        for (const id of skillIds) {
          if (BUILTIN_CORE.includes(id)) continue;
          try {
            const custom = customSkillsMap[id];
            const res = await executeSkill(id, { input: input.trim() }, custom);
            const out =
              typeof res === "object" && res !== null && "output" in res
                ? String((res as { output: unknown }).output)
                : JSON.stringify(res);
            skillContext += `\n【${id}】\n${out}\n`;
          } catch {
            /* skip */
          }
        }

        send({ type: "progress", step: "topic" });
        // 使用流式调用避免 xchai 对非流式请求的约 60 秒超时；失败或 90 秒超时时用输入简化作为 fallback 继续
        const userInputTrim = input.trim();
        const fallbackTopic = userInputTrim.slice(0, 60) + (userInputTrim.length > 60 ? "…" : "") || "研究主题";
        let topic: string;
        const topicTimeout = 30_000; // 30 秒未完成则用 fallback，避免长时间卡在 xchai
        try {
          const topicPromise = (async () => {
            let topicText = "";
            for await (const chunk of generateTextStream({
              system:
                "你是科研选题助手，请根据给定领域与兴趣生成 5-8 个高质量研究主题，使用中文输出，每行一个主题。",
              prompt: `领域: 未指定\n兴趣方向: ${userInputTrim}\n请给出具体可行的研究课题标题。`,
              model,
              apiKey: llmConfig.apiKey,
              baseURL: llmConfig.baseURL,
            })) {
              topicText += chunk;
            }
            const topics = (topicText ?? "")
              .split("\n")
              .map((t) => t.replace(/^[\d\-\.●、\s]+/, "").trim())
              .filter(Boolean);
            return topics[0] ?? fallbackTopic;
          })();
          const race = Promise.race([
            topicPromise,
            new Promise<string>((_, rej) =>
              setTimeout(() => rej(new Error("topic_timeout")), topicTimeout)
            ),
          ]);
          topic = await race;
        } catch (streamErr) {
          try {
            const fallbackPromise = executeTopicGenerate({
              domain: undefined,
              interests: userInputTrim,
            }).then((r) => r.topics[0] ?? fallbackTopic);
            topic = await Promise.race([
              fallbackPromise,
              new Promise<string>((_, rej) =>
                setTimeout(() => rej(new Error("fallback_timeout")), 30_000)
              ),
            ]);
          } catch {
            topic = fallbackTopic;
          }
        }
        send({ type: "topic", data: topic });

        send({ type: "progress", step: "keywords" });
        let kwResult: { keywords: string[] };
        try {
          let kwText = "";
          for await (const chunk of generateTextStream({
            system:
              "你是科研关键词助手，请从主题与上下文中提取 10-20 个高质量关键词与扩展词，使用逗号分隔输出。",
            prompt: `主题: ${topic}\n上下文: ${input.trim()}\n请输出适合文献检索和向量检索的关键词与扩展短语，中文为主，可适当加入英文术语。`,
            model,
            apiKey: llmConfig.apiKey,
            baseURL: llmConfig.baseURL,
          })) {
            kwText += chunk;
          }
          const parts = (kwText ?? "")
            .split(/[,，\n]/)
            .map((t) => t.trim())
            .filter(Boolean);
          kwResult = { keywords: parts };
        } catch (streamErr) {
          kwResult = await executeKeywordSkill({
            topic,
            context: input.trim(),
          });
        }
        send({ type: "keywords", data: kwResult.keywords });

        let ragContext = "";
        if (projectId) {
          try {
            const embedding = await embedText(
              `${input} ${topic} ${kwResult.keywords.slice(0, 5).join(" ")}`
            );
            const chunks = await searchSimilarChunks({
              projectId,
              embedding,
              limit: 6,
            });
            ragContext = chunks.map((c) => c.content).join("\n\n---\n\n");
          } catch {
            /* skip */
          }
        }

        send({ type: "progress", step: "summary" });
        const system =
          "你是科研助手，请根据用户需求、研究主题与关键词，给出一段 200 字左右的研究方向概述。";
        const prompt = `用户需求: ${input}\n主题: ${topic}\n关键词: ${kwResult.keywords.join(
          ", "
        )}${skillContext ? `\n\n技能输出:\n${skillContext.slice(0, 3000)}` : ""}${ragContext ? `\n\n相关文献片段:\n${ragContext.slice(0, 2000)}` : ""}`;
        const h1 = setInterval(() => send({ type: "ping" }), 20_000);
        let summary: string;
        try {
          summary = await generateText({
            system,
            prompt,
            model,
            apiKey: llmConfig.apiKey,
            baseURL: llmConfig.baseURL,
          });
        } finally {
          clearInterval(h1);
        }
        send({ type: "summary", data: summary ?? "" });

        send({ type: "progress", step: "outline" });
        const outlineSystem =
          "你是论文写作助手。请根据研究主题与概述，生成论文大纲（中文），每行一个章节标题，如：1. 引言、2. 相关工作、3. 方法...";
        const outlinePrompt = `主题: ${topic}\n概述: ${summary}`;
        const h2 = setInterval(() => send({ type: "ping" }), 20_000);
        let outlineText: string;
        try {
          outlineText = await generateText({
            system: outlineSystem,
            prompt: outlinePrompt,
            model,
            apiKey: llmConfig.apiKey,
            baseURL: llmConfig.baseURL,
          });
        } finally {
          clearInterval(h2);
        }
        const outline = outlineText
          .split("\n")
          .map((s) => s.replace(/^\d+[\.\、]\s*/, "").trim())
          .filter(Boolean);
        send({ type: "outline", data: outline });

        send({ type: "progress", step: "paper" });
        const paperSystem =
          "你是论文写作助手。请根据大纲与文献上下文，撰写一篇完整的学术论文正文（中文），包含各章节内容，格式清晰，可分段。";
        const paperPrompt = `主题: ${topic}\n概述: ${summary}\n大纲:\n${outline.join("\n")}${
          skillContext ? `\n\n技能输出:\n${skillContext.slice(0, 3000)}` : ""
        }${ragContext ? `\n\n参考文献:\n${ragContext.slice(0, 3000)}` : ""}`;
        let paper = "";
        try {
          for await (const chunk of generateTextStream({
            system: paperSystem,
            prompt: paperPrompt,
            model,
            apiKey: llmConfig.apiKey,
            baseURL: llmConfig.baseURL,
          })) {
            paper += chunk;
            send({ type: "paperChunk", data: chunk });
          }
        } catch (streamErr) {
          // 若流式不支持（如 xchai 限制），回退到非流式 + 心跳
          const h = setInterval(() => send({ type: "ping" }), 15_000);
          try {
            paper = await generateText({
              system: paperSystem,
              prompt: paperPrompt,
              model,
              apiKey: llmConfig.apiKey,
              baseURL: llmConfig.baseURL,
            });
          } finally {
            clearInterval(h);
          }
        }

        send({
          type: "done",
          data: {
            userInput: input.trim(),
            topic,
            keywords: kwResult.keywords,
            summary: summary ?? "",
            outline,
            paper: paper ?? "",
          },
        });
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Internal error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 禁用 nginx 等代理的缓冲
    },
  });
}
