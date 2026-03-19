import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateTextStream } from "@/lib/llm/openai";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export const runtime = "nodejs";
export const maxDuration = 120;

function sse(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** 流式生成论文大纲，支持中断 */
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
        const body = await req.json().catch(() => ({}));
        const {
          selectedTitle,
          innovations,
          researchDirections,
          paperStructure,
          experimentAndVerification,
          improvementsOrShortcomings,
          improvementSuggestions,
          model,
        } = body as {
          selectedTitle?: string;
          innovations?: string;
          researchDirections?: string;
          paperStructure?: string;
          experimentAndVerification?: string;
          improvementsOrShortcomings?: string;
          improvementSuggestions?: string;
          model?: string;
        };

        if (!selectedTitle?.trim()) {
          send({ type: "error", error: "请先选择论文题目" });
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

        let llmConfig: LLMModuleConfig | undefined;
        const { data: settingsRow } = await supabase
          .from("user_llm_settings")
          .select("settings")
          .eq("user_id", user.id)
          .single();
        const raw = (settingsRow?.settings as Record<string, LLMModuleConfig>) ?? {};
        const mod = raw.literature_analysis;
        if (mod && (mod.api_key || mod.base_url || mod.model)) {
          llmConfig = mod as LLMModuleConfig;
        }

        const contextParts: string[] = [`【论文题目】\n${selectedTitle.trim()}`];
        if (innovations?.trim()) contextParts.push(`【创新点】\n${innovations}`);
        if (researchDirections?.trim()) contextParts.push(`【研究方向】\n${researchDirections}`);
        if (paperStructure?.trim()) contextParts.push(`【论文结构】\n${paperStructure}`);
        if (experimentAndVerification?.trim())
          contextParts.push(`【实验设计与验证】\n${experimentAndVerification}`);
        if (improvementsOrShortcomings?.trim())
          contextParts.push(`【改进方向与不足】\n${improvementsOrShortcomings}`);
        if (improvementSuggestions?.trim())
          contextParts.push(`【改进意见与创新点】\n${improvementSuggestions}`);

        const MARKDOWN_INSTRUCTION =
          "请使用 Markdown 格式输出，包括标题（##）、有序/无序列表（- 或 1.）、加粗（**）等，使结构清晰易读。";
        const system =
          "你是论文结构设计专家。根据选定的论文题目及文献分析结果，给出完整论文大纲，包括各章节标题、子节与写作要点，层次清晰。" +
          MARKDOWN_INSTRUCTION;
        const prompt = `【分析内容】\n${contextParts.join("\n\n---\n\n")}\n\n请基于以上论文题目与分析内容，生成完整论文大纲。`;

        send({ type: "start" });

        let full = "";
        for await (const chunk of generateTextStream({
          system,
          prompt,
          model: model || llmConfig?.model,
          apiKey: llmConfig?.api_key,
          baseURL: (llmConfig as { base_url?: string })?.base_url,
        })) {
          if (aborted) break;
          full += chunk;
          send({ type: "chunk", text: chunk });
        }

        if (!aborted) {
          send({ type: "done", outline: full.trim() });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "生成失败";
        console.error("[论文大纲流式]", msg, err);
        send({ type: "error", error: msg });
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
      "X-Accel-Buffering": "no",
    },
  });
}
