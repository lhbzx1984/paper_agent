import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/** 删除项目中无内容（无 document_chunks）的文档 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body as { projectId?: string };

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

    const { data: docs } = await supabase
      .from("documents")
      .select("id")
      .eq("project_id", projectId);

    if (!docs?.length) {
      return NextResponse.json({ deleted: 0, message: "无文档需清理" });
    }

    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("document_id")
      .eq("project_id", projectId);

    const docsWithChunks = new Set(
      (chunks ?? []).map((c) => c.document_id)
    );
    const emptyDocIds = (docs ?? [])
      .filter((d) => !docsWithChunks.has(d.id))
      .map((d) => d.id);

    if (emptyDocIds.length === 0) {
      return NextResponse.json({ deleted: 0, message: "所有文档均有内容，无需清理" });
    }

    const { error } = await supabase
      .from("documents")
      .delete()
      .in("id", emptyDocIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      deleted: emptyDocIds.length,
      message: `已删除 ${emptyDocIds.length} 个无内容文档`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
