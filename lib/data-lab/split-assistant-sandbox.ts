/**
 * 拆分助手消息：正文与「Python 执行结果」附录（与 data-lab-e2b-tools 追加格式一致）
 */
export function splitAssistantSandboxAppend(content: string): {
  main: string;
  sandboxAppend?: string;
} {
  const re = /\r?\n\r?\n---\r?\n\*\*Python 执行结果\*\*\r?\n/;
  const m = re.exec(content);
  if (!m || m.index === undefined) {
    return { main: content };
  }
  const main = content.slice(0, m.index);
  const rest = content.slice(m.index + m[0].length).trim();
  const fence = /^```[^\n]*\r?\n([\s\S]*?)```\s*$/m.exec(rest);
  const sandboxAppend = fence ? fence[1].trim() : rest;
  return { main, sandboxAppend };
}
