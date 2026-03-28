import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createHash } from "crypto";

export const runtime = "nodejs";

const WHOLE_PROJECT_SET_HASH = "whole_project";

function computeDocumentSetHash(documentIds: string[]) {
  const normalized = documentIds.map((d) => d.trim()).filter(Boolean).sort();
  return createHash("sha256").update(normalized.join(",")).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      projectId,
      documentId,
      documentIds,
      documentName,
      innovations,
      researchDirections,
      paperStructure,
      experimentAndVerification,
      improvementsOrShortcomings,
      improvementSuggestions,
      paperTitles,
      selectedTitle,
      paperOutline,
      paperExperimentDesign,
    } = body as {
      projectId?: string;
      documentId?: string | null;
      documentIds?: string[];
      documentName?: string;
      innovations?: string;
      researchDirections?: string;
      paperStructure?: string;
      experimentAndVerification?: string;
      improvementsOrShortcomings?: string;
      improvementSuggestions?: string;
      paperTitles?: string[];
      selectedTitle?: string;
      paperOutline?: string;
      paperExperimentDesign?: string;
    };

    if (!projectId?.trim()) {
      return NextResponse.json({ error: "projectId 不能为空" }, { status: 400 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "项目不存在或无权访问" }, { status: 403 });
    }

    const normalizedDocIds = Array.isArray(documentIds)
      ? documentIds.map((d) => d.trim()).filter(Boolean)
      : [];
    const isMulti = normalizedDocIds.length > 0;

    const docId = isMulti ? null : documentId?.trim() || null;
    const docSetHash = isMulti
      ? computeDocumentSetHash(normalizedDocIds)
      : docId == null
        ? WHOLE_PROJECT_SET_HASH
        : null;

    let query = supabase
      .from("document_analysis")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (isMulti) {
      query = query.eq("document_set_hash", docSetHash);
    } else if (docId == null) {
      query = query.eq("document_set_hash", WHOLE_PROJECT_SET_HASH);
    } else {
      query = query.eq("document_id", docId).is("document_set_hash", null);
    }
    const { data: existing } = await query.maybeSingle();

    const docIdsForRow = isMulti
      ? normalizedDocIds.slice().sort()
      : [];

    const row = {
      project_id: projectId,
      document_id: docId,
      document_ids: docIdsForRow,
      document_set_hash: docSetHash,
      user_id: user.id,
      document_name: documentName?.trim() || null,
      innovations: innovations ?? null,
      research_directions: researchDirections ?? null,
      paper_structure: paperStructure ?? null,
      experiment_and_verification: experimentAndVerification ?? null,
      improvements_or_shortcomings: improvementsOrShortcomings ?? null,
      improvement_suggestions: improvementSuggestions ?? null,
      paper_titles: Array.isArray(paperTitles) ? paperTitles : null,
      selected_title: selectedTitle ?? null,
      paper_outline: paperOutline ?? null,
      paper_experiment_design: paperExperimentDesign ?? null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateErr } = await supabase
        .from("document_analysis")
        .update(row)
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: insertErr } = await supabase
        .from("document_analysis")
        .insert({
          ...row,
          created_at: new Date().toISOString(),
        });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "保存失败" },
      { status: 500 }
    );
  }
}
