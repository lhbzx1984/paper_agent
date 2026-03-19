-- 用户大模型设置表（按功能模块配置模型）
CREATE TABLE IF NOT EXISTS user_llm_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_llm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own llm settings"
  ON user_llm_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own llm settings"
  ON user_llm_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own llm settings"
  ON user_llm_settings FOR UPDATE
  USING (auth.uid() = user_id);
