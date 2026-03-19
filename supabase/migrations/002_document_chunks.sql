-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 文档块表（含向量）
CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_project_idx ON document_chunks(project_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage chunks in own projects"
  ON document_chunks FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  )
  WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- 相似度检索函数
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  match_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  project_id uuid,
  content text,
  embedding vector(1536),
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
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
