-- 为 document_analysis 增加论文题目与大纲字段
ALTER TABLE document_analysis
  ADD COLUMN IF NOT EXISTS paper_titles jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS selected_title text,
  ADD COLUMN IF NOT EXISTS paper_outline text;
