import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { runLiteratureAnalysisStream } from "@/lib/analysis/literature";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export const runtime = "nodejs";
export const maxDuration = 300;

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
        send({ type: "progress", step: "init" });
        if (aborted) return;

        const body = await req.json();
        const { projectId, documentId, model, focus } = body as {
          projectId?: string;
          documentId?: string;
          model?: string;
          focus?: string;
        };

        if (!projectId?.trim()) {
          send({ type: "error", error: "projectId is required" });
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

        const { data: project } = await supabase
          .from("projects")
          .select("id")
          .eq("id", projectId)
          .eq("user_id", user.id)
          .single();

        if (!project) {
          send({ type: "error", error: "项目不存在或无权访问" });
          controller.close();
          return;
        }

        if (documentId?.trim()) {
          const { data: doc } = await supabase
            .from("documents")
            .select("id, project_id")
            .eq("id", documentId.trim())
            .single();
          if (!doc || doc.project_id !== projectId) {
            send({ type: "error", error: "文档不存在或不属于当前知识库" });
            controller.close();
            return;
          }
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
          llmConfig = {
            api_key: mod.api_key || undefined,
            base_url: mod.base_url || undefined,
            model: model || mod.model,
          };
        } else if (model) {
          llmConfig = { model };
        }
        const llmConfigForLiterature = llmConfig
          ? {
              apiKey: llmConfig.api_key,
              baseURL: llmConfig.base_url,
              model: llmConfig.model,
            }
          : undefined;

        send({ type: "progress", step: "analyzing" });

        const result = await runLiteratureAnalysisStream({
          projectId,
          documentId: documentId?.trim() || undefined,
          model,
          focus,
          llmConfig: llmConfigForLiterature,
          onSection: (key, text) => {
            send({ type: "section", key, text });
          },
        });

        send({ type: "done", data: result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error("[文献分析流式]", msg, err);
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
