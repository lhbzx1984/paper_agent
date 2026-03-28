import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isE2bEnvKeyConfigured } from "@/lib/e2b/env-api-key";
import { isMissingRelationError } from "@/lib/supabase/relation-errors";

export const runtime = "nodejs";

export type DataLabE2bSettingsResponse = {
  /** 是否已可用：环境变量或数据库任一有 Key */
  hasApiKey: boolean;
  /** 环境变量 E2B_API_KEY / E2B_KEY 是否已配置（不暴露具体值） */
  envKeyConfigured: boolean;
  /** 是否在数据库 user_data_lab_e2b 中保存了 Key */
  savedInDatabase: boolean;
  /** 为 true 时需在 Supabase 执行 migrations/012_user_data_lab_e2b.sql */
  migrationRequired?: boolean;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_data_lab_e2b")
      .select("api_key")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      if (isMissingRelationError(error)) {
        const envKeyConfigured = isE2bEnvKeyConfigured();
        return NextResponse.json({
          settings: {
            hasApiKey: envKeyConfigured,
            envKeyConfigured,
            savedInDatabase: false,
            migrationRequired: true,
          } satisfies DataLabE2bSettingsResponse,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const envKeyConfigured = isE2bEnvKeyConfigured();
    const savedInDatabase = !!(data?.api_key && data.api_key.trim());
    const hasApiKey = envKeyConfigured || savedInDatabase;
    return NextResponse.json({
      settings: {
        hasApiKey,
        envKeyConfigured,
        savedInDatabase,
      } satisfies DataLabE2bSettingsResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { apiKey } = body as { apiKey?: string };

    const { data: existing } = await supabase
      .from("user_data_lab_e2b")
      .select("api_key")
      .eq("user_id", user.id)
      .maybeSingle();

    let nextKey = existing?.api_key ?? null;
    if (Object.prototype.hasOwnProperty.call(body, "apiKey")) {
      nextKey =
        typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : null;
    }

    const { error } = await supabase.from("user_data_lab_e2b").upsert(
      {
        user_id: user.id,
        api_key: nextKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json(
          {
            error:
              "数据库尚未创建表 user_data_lab_e2b。请在 Supabase → SQL Editor 执行项目内 supabase/migrations/012_user_data_lab_e2b.sql，或使用环境变量 E2B_API_KEY。",
            migrationRequired: true,
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
