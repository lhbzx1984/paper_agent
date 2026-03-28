/**
 * 仅从 process.env 读取 E2B Key（服务端）。
 * 兼容 E2B_API_KEY（官方）与 E2B_KEY（部分模板使用的别名）。
 */
export function readE2bApiKeyFromEnv(): string | null {
  const raw =
    process.env["E2B_API_KEY"] ??
    process.env["E2B_KEY"];
  const t = typeof raw === "string" ? raw.trim() : "";
  return t.length > 0 ? t : null;
}

export function isE2bEnvKeyConfigured(): boolean {
  return readE2bApiKeyFromEnv() !== null;
}
