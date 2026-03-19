import { createSupabaseServerClient } from "../supabase/server";

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export async function upsertDocumentChunks(
  documentId: string,
  projectId: string,
  chunks: { content: string; embedding: number[]; metadata?: object }[],
) {
  const supabase = await createSupabaseServerClient();

  const rows = chunks.map((chunk) => {
    const emb = chunk.embedding;
    if (!Array.isArray(emb) || emb.length !== 1024) {
      throw new Error(`embedding 维度异常: 期望 1024，实际 ${emb?.length ?? "非数组"}`);
    }
    return {
      document_id: documentId,
      project_id: projectId,
      content: chunk.content,
      embedding: emb,
      metadata: chunk.metadata ?? {},
    };
  });

  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) {
    throw error;
  }
}

export async function getChunksByDocument(documentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id, content, metadata")
    .eq("document_id", documentId);

  if (error) throw error;
  return (data ?? []) as { id: string; content: string; metadata?: { index?: number } }[];
}

export async function getChunksByProject(projectId: string, limit = 24) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id, content, metadata")
    .eq("project_id", projectId)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as { id: string; content: string; metadata?: object }[];
}

/** 获取项目的文档数与文档块数（用于诊断） */
export async function getProjectContentStats(projectId: string) {
  const supabase = await createSupabaseServerClient();
  const [docsRes, chunksRes] = await Promise.all([
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  return {
    documentCount: docsRes.count ?? 0,
    chunkCount: chunksRes.count ?? 0,
  };
}

/** 通过 documents 表获取项目的文档块（当直接查询 document_chunks 为空时的备选） */
export async function getChunksByProjectViaDocuments(
  projectId: string,
  limit = 24
) {
  const supabase = await createSupabaseServerClient();
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", projectId)
    .limit(10);

  if (docsError || !docs?.length) return [];

  const allChunks: { id: string; content: string; metadata?: object }[] = [];
  for (const doc of docs) {
    const chunks = await getChunksByDocument(doc.id);
    allChunks.push(...chunks);
    if (allChunks.length >= limit) break;
  }
  return allChunks.slice(0, limit);
}

export async function searchSimilarChunks(params: {
  projectId: string;
  embedding: number[];
  limit?: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { projectId, embedding, limit = 8 } = params;

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: limit,
    match_project_id: projectId,
  });

  if (error) {
    throw error;
  }

  return data as DocumentChunk[];
}

