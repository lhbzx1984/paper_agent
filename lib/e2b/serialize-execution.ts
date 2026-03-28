import type { Execution } from "@e2b/code-interpreter";

const MAX_HTML = 12_000;

/** 将 E2B Execution 转为可 JSON 返回的安全结构（省略大图 base64） */
export function serializeE2bExecution(execution: Execution) {
  const err = execution.error;
  return {
    text: execution.text,
    logs: {
      stdout: execution.logs.stdout,
      stderr: execution.logs.stderr,
    },
    executionError: err
      ? {
          name: err.name,
          value: err.value,
          traceback: err.traceback,
        }
      : undefined,
    results: execution.results.map((r) => ({
      text: r.text,
      html:
        typeof r.html === "string"
          ? r.html.length > MAX_HTML
            ? `${r.html.slice(0, MAX_HTML)}\n…[已截断]`
            : r.html
          : undefined,
      markdown: r.markdown,
      hasPng: !!r.png,
      hasSvg: !!r.svg,
      hasJpeg: !!r.jpeg,
    })),
  };
}
