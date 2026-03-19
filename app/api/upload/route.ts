import { NextRequest, NextResponse } from "next/server";
import { parseBufferToText } from "@/lib/parser";
import { embedText } from "@/lib/llm/openai";
import { upsertDocumentChunks } from "@/lib/vector/pgvector";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const projectId = formData.get("projectId") as string | null;
    const name = (formData.get("name") as string | null) ?? undefined;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text: string;
    try {
      text = await parseBufferToText(buffer, file.type || "text/plain");
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : "PDF 解析失败";
      return NextResponse.json({ error: `文档解析失败: ${msg}` }, { status: 400 });
    }

    if (!text?.trim()) {
      return NextResponse.json({ error: "文档内容为空或无法提取文本" }, { status: 400 });
    }

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        project_id: projectId,
        name: name ?? file.name,
        size: buffer.byteLength,
        mime_type: file.type || "text/plain",
      })
      .select("id")
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: docError?.message ?? "创建文档失败" }, { status: 500 });
    }

    const rawChunks = chunkText(text, 1200, 200);

    let embeddings: number[][];
    try {
      embeddings = await Promise.all(
        rawChunks.map((chunk) => embedText(chunk)),
      );
    } catch (embedErr) {
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
        })),
      );
    } catch (dbErr) {
      await supabase.from("documents").delete().eq("id", doc.id);
      const errObj = dbErr as { message?: string; code?: string; details?: string };
      let msg =
        dbErr instanceof Error
          ? dbErr.message
          : typeof errObj?.message === "string"
            ? errObj.message
            : typeof errObj?.details === "string"
              ? errObj.details
              : "入库失败";
      console.error("[upload] chunks insert error:", msg, errObj);
      if (/vector|dimension|1024|1536|embedding|invalid input syntax/i.test(msg)) {
        msg += " （数据库已为 vector(1024)，若仍失败请查看终端完整错误）";
      } else if (msg === "入库失败") {
        msg += " 常见原因：未执行迁移 004 或 RLS 权限。";
      }
      return NextResponse.json({ error: `文档入库失败: ${msg}` }, { status: 500 });
    }

    return NextResponse.json({
      id: doc.id,
      chunks: rawChunks.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function chunkText(text: string, size = 1000, overlap = 200): string[] {
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

