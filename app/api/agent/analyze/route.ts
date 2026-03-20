import { NextRequest, NextResponse } from "next/server";
import { runLiteratureAnalysis } from "@/lib/analysis/literature";
import { createClient } from "@/utils/supabase/server";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export const runtime = "nodejs";
/** 文献分析需多次调用 LLM，延长超时时间 */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, documentId, documentIds, model, focus } = body as {
      projectId: string;
      documentId?: string;
      documentIds?: string[];
      model?: string;
      focus?: string;
    };

    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "项目不存在或无权访问" },
        { status: 403 }
      );
    }

    const multiIds =
      Array.isArray(documentIds) && documentIds.length
        ? [...new Set(documentIds.map((d) => d.trim()).filter(Boolean))]
        : [];

    let documentsMeta: { id: string; name?: string | null }[] | undefined;
    if (multiIds.length > 0) {
      const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("id,name")
        .in("id", multiIds)
        .eq("project_id", projectId);

      if (docsErr) {
        return NextResponse.json({ error: docsErr.message }, { status: 400 });
      }

      const found = docs?.map((d) => d.id) ?? [];
      if (found.length !== multiIds.length) {
        return NextResponse.json(
          { error: "部分文档不存在或不属于当前知识库" },
          { status: 400 }
        );
      }
      documentsMeta = docs ?? [];
    } else if (documentId?.trim()) {
      const { data: doc } = await supabase
        .from("documents")
        .select("id, project_id")
        .eq("id", documentId.trim())
        .single();
      if (!doc || doc.project_id !== projectId) {
        return NextResponse.json(
          { error: "文档不存在或不属于当前知识库" },
          { status: 400 }
        );
      }
    }

    const { data: settingsRow } = await supabase
      .from("user_llm_settings")
      .select("settings")
      .eq("user_id", user.id)
      .single();
    const raw = (settingsRow?.settings as Record<string, LLMModuleConfig>) ?? {};
    const mod = raw.literature_analysis;
    let llmConfigForLiterature: { apiKey?: string; baseURL?: string; model?: string } | undefined;
    if (mod && (mod.api_key || mod.base_url || mod.model)) {
      llmConfigForLiterature = {
        apiKey: mod.api_key || undefined,
        baseURL: mod.base_url || undefined,
        model: model || mod.model,
      };
    } else if (model) {
      llmConfigForLiterature = { model };
    }

    const result = await runLiteratureAnalysis({
      projectId,
      model,
      focus,
      documentId: multiIds.length === 0 ? documentId?.trim() || undefined : undefined,
      documentIds: multiIds.length > 0 ? multiIds : undefined,
      documents: documentsMeta,
      llmConfig: llmConfigForLiterature,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[文献分析]", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
