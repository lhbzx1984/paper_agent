import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateTextStream } from "@/lib/llm/openai";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export const runtime = "nodejs";
export const maxDuration = 120;

function sse(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** 基于题目、大纲与文献内实验挖掘，生成本篇论文的实验与验证设计方案（流式） */
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
          selectedTitle,
          paperOutline,
          literatureExperimentMining,
          innovations,
          researchDirections,
          paperStructure,
          model,
        } = body as {
          selectedTitle?: string;
          paperOutline?: string;
          literatureExperimentMining?: string;
          innovations?: string;
          researchDirections?: string;
          paperStructure?: string;
          model?: string;
        };

        if (!selectedTitle?.trim()) {
          send({ type: "error", error: "请先选择或填写论文题目" });
          controller.close();
          return;
        }
        if (!paperOutline?.trim()) {
          send({ type: "error", error: "请先生成论文大纲" });
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

        const MARKDOWN_INSTRUCTION =
          "请使用 Markdown 格式输出，包括标题（##）、有序/无序列表（- 或 1.）、加粗（**）等。";

        const parts: string[] = [
          `【论文题目】\n${selectedTitle.trim()}`,
          `【论文大纲】\n${paperOutline.trim()}`,
        ];
        if (literatureExperimentMining?.trim()) {
          parts.push(
            `【文献内实验与验证梳理】（仅供对齐与继承，勿逐字复述）\n${literatureExperimentMining.trim().slice(0, 12000)}`,
          );
        }
        if (innovations?.trim()) {
          parts.push(`【创新点摘要】\n${innovations.trim().slice(0, 6000)}`);
        }
        if (researchDirections?.trim()) {
          parts.push(`【研究方向摘要】\n${researchDirections.trim().slice(0, 4000)}`);
        }
        if (paperStructure?.trim()) {
          parts.push(`【论文结构参考】\n${paperStructure.trim().slice(0, 4000)}`);
        }

        const system =
          "你是实验设计与方法论专家。用户已确定拟撰写论文的题目与大纲，并提供了从参考文献中梳理出的实验与验证要点。" +
          "请**针对该题目与大纲**，撰写一份「本篇论文」的实验与验证设计方案：包括研究问题与假设、数据与任务、基线与对比、评价指标、消融/稳健性（如适用）、验证步骤与可复现性说明。" +
          "方案须与大纲章节逻辑一致，可合理延伸文献思路，但应明确区分「继承自文献的设定」与「本篇论文计划新增或调整的部分」。" +
          "**禁止**凭空编造具体数据集名称或实验数值；若需占位请用通用表述并标注待填。" +
          MARKDOWN_INSTRUCTION;

        const prompt = `【输入材料】\n\n${parts.join("\n\n---\n\n")}\n\n请输出《实验与验证设计方案》，面向「${selectedTitle.trim()}」这一篇论文的写作与实施。`;

        send({ type: "start" });

        let full = "";
        for await (const chunk of generateTextStream({
          system,
          prompt,
          model: model || llmConfig?.model,
          apiKey: llmConfig?.api_key,
          baseURL: llmConfig?.base_url,
        })) {
          if (aborted) break;
          full += chunk;
          send({ type: "chunk", text: chunk });
        }

        if (!aborted) {
          send({ type: "done", content: full });
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
