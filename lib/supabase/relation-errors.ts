/** PostgREST：表未创建或未进入 schema cache 时的典型错误 */
export function isMissingRelationError(error: {
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST205") return true;
  const m = (error.message ?? "").toLowerCase();
  return (
    m.includes("schema cache") ||
    (m.includes("could not find") && m.includes("table"))
  );
}
