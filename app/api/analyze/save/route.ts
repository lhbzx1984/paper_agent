import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

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
    } = body as {
      projectId?: string;
      documentId?: string | null;
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

    const docId = documentId?.trim() || null;

    let query = supabase
      .from("document_analysis")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (docId == null) {
      query = query.is("document_id", null);
    } else {
      query = query.eq("document_id", docId);
    }
    const { data: existing } = await query.maybeSingle();

    const row = {
      project_id: projectId,
      document_id: docId,
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
