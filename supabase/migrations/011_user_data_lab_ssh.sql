-- 数据实验分析：SSH 云平台连接（凭据仅存于用户行，由 RLS 隔离）
CREATE TABLE IF NOT EXISTS user_data_lab_ssh (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  host text,
  port int NOT NULL DEFAULT 22,
  username text,
  auth_type text NOT NULL DEFAULT 'private_key' CHECK (auth_type IN ('password', 'private_key')),
  private_key text,
  key_passphrase text,
  password text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_data_lab_ssh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own data lab ssh settings"
  ON user_data_lab_ssh FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
