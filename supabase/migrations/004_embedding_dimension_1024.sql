-- 将向量维度从 1536（OpenAI）改为 1024（智谱 Embedding-3）
-- 注意：若已有文档，需重新上传以生成新向量

-- 1. 删除旧索引
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 2. 删除旧函数
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), int, uuid);

-- 3. 修改 embedding 列
ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE document_chunks ADD COLUMN embedding vector(1024);

-- 4. 重建索引
CREATE INDEX document_chunks_embedding_idx ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 5. 重建相似度检索函数
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1024),
  match_count int DEFAULT 8,
  match_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  project_id uuid,
  content text,
  embedding vector(1024),
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.project_id,
    dc.content,
    dc.embedding,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE (match_project_id IS NULL OR dc.project_id = match_project_id)
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
