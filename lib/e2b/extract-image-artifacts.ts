import type { Execution } from "@e2b/code-interpreter";

const MAX_IMAGES = 8;
/** 单张 base64 字符串长度上限（约 1.1MB 量级） */
const MAX_B64_CHARS = 1_500_000;

function normalizeBase64(raw: string): string {
  const s = raw.trim();
  const dataUrl = s.match(/^data:image\/[\w+.-]+;base64,([\s\S]+)$/);
  if (dataUrl) return dataUrl[1].replace(/\s/g, "");
  return s.replace(/\s/g, "");
}

export type E2bImageArtifact = {
  mime: string;
  base64: string;
};

/**
 * 从 Code Interpreter 执行结果中提取可下发的图片（PNG / JPEG / SVG）。
 */
export function extractE2bImageArtifacts(execution: Execution): E2bImageArtifact[] {
  const out: E2bImageArtifact[] = [];

  for (const r of execution.results) {
    if (out.length >= MAX_IMAGES) break;

    if (r.png && typeof r.png === "string") {
      const b64 = normalizeBase64(r.png);
      if (b64.length > 0 && b64.length <= MAX_B64_CHARS) {
        out.push({ mime: "image/png", base64: b64 });
      }
    }
    if (out.length >= MAX_IMAGES) break;

    if (r.jpeg && typeof r.jpeg === "string") {
      const b64 = normalizeBase64(r.jpeg);
      if (b64.length > 0 && b64.length <= MAX_B64_CHARS) {
        out.push({ mime: "image/jpeg", base64: b64 });
      }
    }
    if (out.length >= MAX_IMAGES) break;

    if (r.svg && typeof r.svg === "string") {
      const svg = r.svg.trim();
      if (svg.length === 0 || svg.length > MAX_B64_CHARS) continue;
      const b64 = Buffer.from(svg, "utf8").toString("base64");
      if (b64.length <= MAX_B64_CHARS) {
        out.push({ mime: "image/svg+xml", base64: b64 });
      }
    }
  }

  return out;
}
