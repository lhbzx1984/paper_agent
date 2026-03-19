# Supabase 迁移

在 Supabase 控制台 → SQL Editor 中依次执行：

1. `migrations/001_projects.sql` - 创建 projects 和 documents 表及 RLS
2. `migrations/002_document_chunks.sql` - 创建 document_chunks（含 pgvector）、match_document_chunks 函数
3. `migrations/003_custom_skills.sql` - 创建 custom_skills 表（用户自定义技能）

若已有 `documents` 表结构不同，请根据实际情况调整迁移脚本。

**若已执行过旧版迁移**，需先删除旧策略再执行新策略：

```sql
DROP POLICY IF EXISTS "Users can manage documents in own projects" ON documents;
-- 然后执行 001_projects.sql 中 documents 的 CREATE POLICY 部分
```
