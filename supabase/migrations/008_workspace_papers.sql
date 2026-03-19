-- 研究工作台保存的论文（合并后的最终稿）
CREATE TABLE IF NOT EXISTS workspace_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '未命名论文',
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_papers_user_idx ON workspace_papers(user_id);

ALTER TABLE workspace_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workspace papers"
  ON workspace_papers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
