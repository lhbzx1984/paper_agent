import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/llm/openai";

export const runtime = "nodejs";

/** 诊断：检查 document_chunks 表的 embedding 列类型及当前生成的向量维度 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // 查询 embedding 列定义
    const { data: colData, error: colError } = await supabase.rpc("exec_sql", {
      sql: `SELECT udt_name, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'document_chunks' AND column_name = 'embedding'`,
    }).catch(() => ({ data: null, error: { message: "RPC not available" } }));

    // Supabase 可能没有 exec_sql，改用 raw SQL 通过 REST
    const { data: schemaData } = await supabase
      .from("document_chunks")
      .select("embedding")
      .limit(1);

    // 生成一个测试向量看维度
    let embedDim = 0;
    try {
      const testEmbed = await embedText("test");
      embedDim = testEmbed?.length ?? 0;
    } catch (e) {
      embedDim = -1;
    }

    // 尝试获取表结构：通过 query 查询
    const check: Record<string, unknown> = {
      embeddingApiDimension: embedDim,
      note: "Zhipu 应返回 1024 维；迁移 004 后 DB 应为 vector(1024)",
    };

    if (schemaData && Array.isArray(schemaData) && schemaData.length > 0) {
      const first = schemaData[0] as { embedding?: unknown };
      if (Array.isArray(first?.embedding)) {
        check.dbColumnDimension = first.embedding.length;
      } else if (first?.embedding != null) {
        check.dbColumnSample = "non-array (might be string)";
      }
    } else if (schemaData && Array.isArray(schemaData) && schemaData.length === 0) {
      check.dbColumnCheck = "表无数据，无法从样本推断维度";
    }

    return NextResponse.json(check);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "诊断失败" },
      { status: 500 }
    );
  }
}
