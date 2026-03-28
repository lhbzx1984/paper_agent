/** 将 executePythonInE2bSandbox 的 toolContent JSON 格式化为可读文本 */
export function formatSandboxAppendFromToolJson(toolContent: string): string {
  try {
    const j = JSON.parse(toolContent) as {
      logs?: { stdout?: string[]; stderr?: string[] };
      executionError?: { name?: string; value?: string; traceback?: string };
      text?: string;
    };
    if (j.executionError) {
      const t =
        j.executionError.traceback ||
        j.executionError.value ||
        j.executionError.name ||
        "执行错误";
      return String(t);
    }
    const lines: string[] = [];
    if (j.text) lines.push(String(j.text));
    if (j.logs?.stdout?.length) lines.push(j.logs.stdout.join(""));
    if (j.logs?.stderr?.length) lines.push(j.logs.stderr.join(""));
    return lines.filter(Boolean).join("\n") || "(无文本输出)";
  } catch {
    return toolContent.slice(0, 4000);
  }
}
