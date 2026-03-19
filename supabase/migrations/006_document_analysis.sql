-- ============================================================
-- 文献分析结果表 document_analysis
-- ============================================================
-- 用途：存储用户在「文献分析」页面对文档的分析结果，供「研究工作台」调用
--
-- 与其它表的关系：
--   project_id  -> projects.id    （分析属于哪个知识库）
--   document_id -> documents.id   （分析的是哪篇文档；NULL = 分析整个知识库「全部文档」）
--   user_id     -> auth.users.id  （分析归属用户）
--
-- 唯一约束：每个 (project_id, document_id) 只保留一条记录
--   - 保存时：若已存在则更新，否则插入
--   - PostgreSQL 中 UNIQUE 对 NULL 视为相等，故 (project_id, NULL) 也只会有一条
-- ============================================================

CREATE TABLE IF NOT EXISTS document_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_name text,
  innovations text,
  research_directions text,
  paper_structure text,
  experiment_and_verification text,
  improvements_or_shortcomings text,
  improvement_suggestions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, document_id)
);

CREATE INDEX IF NOT EXISTS document_analysis_project_idx ON document_analysis(project_id);
CREATE INDEX IF NOT EXISTS document_analysis_user_idx ON document_analysis(user_id);

ALTER TABLE document_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own document analysis"
  ON document_analysis FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
