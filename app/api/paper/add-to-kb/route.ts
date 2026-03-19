import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/llm/openai";
import { upsertDocumentChunks } from "@/lib/vector/pgvector";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@/utils/supabase/server";
import { getPaperDetail } from "@/lib/openalex/client";

export const runtime = "nodejs";

function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
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
    const paperId = body.paperId as string | null;
    const projectId = body.projectId as string | null;

    if (!paperId?.trim() || !projectId?.trim()) {
      return NextResponse.json(
        { error: "paperId 和 projectId 不能为空" },
        { status: 400 }
      );
    }

    const paper = await getPaperDetail(paperId.trim());
    if (!paper) {
      return NextResponse.json({ error: "未找到该论文" }, { status: 404 });
    }

    let text: string;
    // OpenAlex 目前优先使用 abstract（由 inverted index 还原），避免依赖付费/带配额的 PDF 内容下载
    text = paper.abstract?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "该论文摘要不可用（OpenAlex 未返回可还原的 abstract）" },
        { status: 400 }
      );
    }
    text = `标题: ${paper.title ?? "未知"}\n\n摘要:\n${text}`;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "文档内容为空或无法提取文本" },
        { status: 400 }
      );
    }

    const db = await createSupabaseServerClient();
    const docName = (paper.title ?? paperId).slice(0, 200);

    const { data: doc, error: docError } = await db
      .from("documents")
      .insert({
        project_id: projectId,
        name: docName,
        size: text.length,
        mime_type: "text/plain",
      })
      .select("id")
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: docError?.message ?? "创建文档失败" },
        { status: 500 }
      );
    }

    const rawChunks = chunkText(text, 1200, 200);

    let embeddings: number[][];
    try {
      embeddings = await Promise.all(rawChunks.map((chunk) => embedText(chunk)));
    } catch (embedErr) {
      await db.from("documents").delete().eq("id", doc.id);
      const msg = embedErr instanceof Error ? embedErr.message : "向量化失败";
      return NextResponse.json({ error: `向量化失败: ${msg}` }, { status: 500 });
    }

    try {
      await upsertDocumentChunks(
        doc.id,
        projectId,
        rawChunks.map((content, i) => ({
          content,
          embedding: embeddings[i],
          metadata: { index: i },
        }))
      );
    } catch (dbErr) {
      await db.from("documents").delete().eq("id", doc.id);
      const errObj = dbErr as { message?: string };
      const msg = dbErr instanceof Error ? dbErr.message : errObj?.message ?? "入库失败";
      return NextResponse.json({ error: `文档入库失败: ${msg}` }, { status: 500 });
    }

    return NextResponse.json({
      id: doc.id,
      chunks: rawChunks.length,
      source: "abstract",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "添加失败" },
      { status: 500 }
    );
  }
}
