-- 移除「SSH 云平台」功能：删除用户 SSH 连接表
DROP POLICY IF EXISTS "Users manage own data lab ssh settings" ON user_data_lab_ssh;
DROP TABLE IF EXISTS user_data_lab_ssh;
