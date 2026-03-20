import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createHash } from "crypto";

export const runtime = "nodejs";

const WHOLE_PROJECT_SET_HASH = "whole_project";

function computeDocumentSetHash(documentIds: string[]) {
  const normalized = documentIds.map((d) => d.trim()).filter(Boolean).sort();
  return createHash("sha256").update(normalized.join(",")).digest("hex");
}

/** 获取已保存的文献分析，供研究工作台调用 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const documentId = searchParams.get("documentId");
    const documentIdsParam = searchParams.get("documentIds");
    const documentSetHashParam = searchParams.get("documentSetHash");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId 不能为空" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("document_analysis")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (documentId) {
      query = query.eq("document_id", documentId).is("document_set_hash", null);
    } else if (documentSetHashParam) {
      query = query.eq("document_set_hash", documentSetHashParam);
    } else if (documentIdsParam) {
      const ids = documentIdsParam.split(",").map((d) => d.trim()).filter(Boolean);
      const hash = computeDocumentSetHash(ids);
      query = query.eq("document_set_hash", hash);
    } else {
      // 默认：整库分析（全部文档）
      query = query.eq("document_set_hash", WHOLE_PROJECT_SET_HASH);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        id: data.id,
        projectId: data.project_id,
        documentId: data.document_id,
        documentName: data.document_name,
        innovations: data.innovations,
        researchDirections: data.research_directions,
        paperStructure: data.paper_structure,
        experimentAndVerification: data.experiment_and_verification,
        improvementsOrShortcomings: data.improvements_or_shortcomings,
        improvementSuggestions: data.improvement_suggestions,
        paperTitles: Array.isArray(data.paper_titles) ? data.paper_titles : [],
        selectedTitle: data.selected_title,
        paperOutline: data.paper_outline,
        updatedAt: data.updated_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "获取失败" },
      { status: 500 }
    );
  }
}

/** 删除已保存的文献分析 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const documentId = searchParams.get("documentId");
    const documentIdsParam = searchParams.get("documentIds");
    const documentSetHashParam = searchParams.get("documentSetHash");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId 不能为空" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("document_analysis")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (documentId) {
      query = query.eq("document_id", documentId).is("document_set_hash", null);
    } else if (documentSetHashParam) {
      query = query.eq("document_set_hash", documentSetHashParam);
    } else if (documentIdsParam) {
      const ids = documentIdsParam.split(",").map((d) => d.trim()).filter(Boolean);
      const hash = computeDocumentSetHash(ids);
      query = query.eq("document_set_hash", hash);
    } else {
      query = query.eq("document_set_hash", WHOLE_PROJECT_SET_HASH);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "删除失败" },
      { status: 500 }
    );
  }
}
