-- 数据实验分析：E2B Code Interpreter API Key（凭据仅存于用户行，由 RLS 隔离）
CREATE TABLE IF NOT EXISTS user_data_lab_e2b (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_data_lab_e2b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own data lab e2b settings"
  ON user_data_lab_e2b FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
