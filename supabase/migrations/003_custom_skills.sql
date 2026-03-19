-- 用户自定义技能表
CREATE TABLE IF NOT EXISTS custom_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  prompt_template text DEFAULT '用户输入：\n{{input}}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own custom skills"
  ON custom_skills FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
