import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateTextStream } from "@/lib/llm/openai";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";
import { executeSkill } from "@/lib/skills/registry";
import { listSkills } from "@/lib/skills/registry";

export const runtime = "nodejs";
export const maxDuration = 300;

function sse(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** 按大纲分步生成论文章节 */
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
          outlineSection,
          sectionIndex,
          previousSections,
          fullOutline,
          skillIds = [],
          model: bodyModel,
          maxLength = 3000,
        } = body as {
          outlineSection?: string;
          sectionIndex?: number;
          previousSections?: { section: string; content: string }[];
          fullOutline?: string;
          skillIds?: string[];
          model?: string;
          maxLength?: number;
        };

        const limit = Math.min(Math.max(Number(maxLength) || 3000, 500), 20000);

        if (!outlineSection?.trim()) {
          send({ type: "error", error: "outlineSection 不能为空" });
          controller.close();
          return;
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          send({ type: "error", error: "Unauthorized" });
          controller.close();
          return;
        }

        let model = bodyModel?.trim() || "";
        let llmConfig: { apiKey?: string; baseURL?: string; model?: string } = {
          model: model || undefined,
        };
        const { data: settingsRow } = await supabase
          .from("user_llm_settings")
          .select("settings")
          .eq("user_id", user.id)
          .single();
        const raw = (settingsRow?.settings as Record<string, LLMModuleConfig>) ?? {};
        const mod = raw.workspace;
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

        if (!model) {
          send({
            type: "error",
            error:
              "model 未配置：请在“研究工作台/大模型设置”中填写 model，并配置 base_url + api_key。",
          });
          controller.close();
          return;
        }

        let skillContext = "";
        const builtinIds = new Set(listSkills().map((s) => s.id));
        const customIds = skillIds.filter((id: string) => !builtinIds.has(id));
        let customSkillsMap: Record<string, { system_prompt: string; prompt_template: string }> = {};
        if (customIds.length > 0) {
          const { data: skillsData } = await supabase
            .from("custom_skills")
            .select("id, system_prompt, prompt_template")
            .eq("user_id", user.id)
            .in("id", customIds);
          for (const s of skillsData ?? []) {
            customSkillsMap[s.id] = {
              system_prompt: s.system_prompt,
              prompt_template: s.prompt_template,
            };
          }
        }
        for (const id of skillIds) {
          try {
            const custom = customSkillsMap[id];
            const res = await executeSkill(id, { input: outlineSection }, custom);
            const out =
              typeof res === "object" && res !== null && "output" in res
                ? String((res as { output: unknown }).output)
                : JSON.stringify(res);
            skillContext += `\n【${id}】\n${out}\n`;
          } catch {
            /* skip */
          }
        }

        const prevContext =
          Array.isArray(previousSections) && previousSections.length > 0
            ? previousSections
                .map((p) => `## ${p.section}\n\n${p.content}`)
                .join("\n\n---\n\n")
            : "";

        const system =
          "你是论文写作助手。请根据大纲中的本节要求，撰写该章节的完整学术论文内容（中文），格式清晰，可分段，符合学术写作规范。";
        const prompt = `【论文大纲】\n${fullOutline ?? outlineSection}\n\n【本节要求】\n${outlineSection}${
          prevContext ? `\n\n【已撰写的前文】\n${prevContext}` : ""
        }${skillContext ? `\n\n【技能输出】\n${skillContext.slice(0, 3000)}` : ""}\n\n【字数限制】本节内容请控制在 ${limit} 字以内。\n\n请撰写本节内容：`;

        send({ type: "start" });

        let full = "";
        for await (const chunk of generateTextStream({
          system,
          prompt,
          model,
          apiKey: llmConfig.apiKey,
          baseURL: llmConfig.baseURL,
        })) {
          if (aborted) break;
          if (full.length >= limit) break;
          const remain = limit - full.length;
          const add = chunk.length <= remain ? chunk : chunk.slice(0, remain);
          full += add;
          send({ type: "chunk", text: add });
        }

        if (!aborted) {
          send({ type: "done", content: full.trim() });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "生成失败";
        console.error("[workspace generate-section]", msg, err);
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
