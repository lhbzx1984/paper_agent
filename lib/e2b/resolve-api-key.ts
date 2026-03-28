import type { SupabaseClient } from "@supabase/supabase-js";
import { readE2bApiKeyFromEnv } from "@/lib/e2b/env-api-key";
import { isMissingRelationError } from "@/lib/supabase/relation-errors";

/**
 * 优先使用服务端环境变量 E2B_API_KEY（或 E2B_KEY），否则使用 user_data_lab_e2b 表中保存的 Key。
 */
export async function resolveE2bApiKey(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const env = readE2bApiKeyFromEnv();
  if (env) return env;

  const { data, error } = await supabase
    .from("user_data_lab_e2b")
    .select("api_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return null;
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[resolveE2bApiKey] 读取 user_data_lab_e2b 失败:",
        error.code,
        error.message,
      );
    }
    return null;
  }
  if (!data?.api_key?.trim()) return null;
  return data.api_key.trim();
}
