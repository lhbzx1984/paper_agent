import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getChunksByDocument } from "@/lib/vector/pgvector";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "document id required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, name, project_id")
      .eq("id", id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", doc.project_id)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const chunks = await getChunksByDocument(id);
    const text = chunks
      .sort((a, b) => (a.metadata?.index ?? 0) - (b.metadata?.index ?? 0))
      .map((c) => c.content)
      .join("\n\n");

    const filename = `${doc.name.replace(/\.[^.]+$/, "")}_导出.txt`;
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
