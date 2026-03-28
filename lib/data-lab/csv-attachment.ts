/** 与 `app/api/agent/data-lab/chat/stream` 中 normalizeMessages 的单条 content 上限一致 */
export const DATA_LAB_MESSAGE_MAX_CHARS = 48000;

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "").trim() || "data.csv";
  return base.slice(0, 200);
}

/**
 * 将用户输入与可选的 CSV 正文合并为一条发往后端的 user content。
 */
export function buildDataLabUserPayload(
  userText: string,
  csv: { name: string; text: string } | null,
): { content: string; csvTruncated: boolean } {
  if (!csv) {
    return {
      content: userText.trim().slice(0, DATA_LAB_MESSAGE_MAX_CHARS),
      csvTruncated: false,
    };
  }
  const intro = (userText.trim() || "请阅读并分析下列 CSV 数据。").slice(0, 4000);
  const safeName = sanitizeFileName(csv.name);
  const head = `\n\n---\n【用户上传的 CSV 文件：${safeName}】\n\`\`\`csv\n`;
  const tail = `\n\`\`\`\n`;
  const overhead = intro.length + head.length + tail.length + 120;
  const budget = Math.max(0, DATA_LAB_MESSAGE_MAX_CHARS - overhead);
  let body = csv.text;
  let csvTruncated = false;
  if (body.length > budget) {
    body = body.slice(0, budget);
    csvTruncated = true;
  }
  if (csvTruncated) {
    body += "\n\n（CSV 内容已截断以符合单次对话长度限制）";
  }
  const merged = (intro + head + body + tail).slice(0, DATA_LAB_MESSAGE_MAX_CHARS);
  return { content: merged, csvTruncated };
}
