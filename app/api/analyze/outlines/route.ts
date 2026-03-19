import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/** 列出用户所有含论文大纲的文献分析，供研究工作台导入 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("document_analysis")
      .select("id, project_id, document_id, document_name, selected_title, paper_outline, updated_at")
      .eq("user_id", user.id)
      .not("paper_outline", "is", null)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (data ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      documentId: r.document_id,
      documentName: r.document_name,
      selectedTitle: r.selected_title,
      paperOutline: r.paper_outline,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ outlines: items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "获取失败" },
      { status: 500 }
    );
  }
}
