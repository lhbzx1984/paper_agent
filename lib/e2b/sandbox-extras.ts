const MAX_PATH_LEN = 512;
const MAX_UPLOAD_TOTAL = 480_000;
const MAX_PIP_PACKAGES = 40;

/** 仅允许写入/读取用户目录下路径，防止路径穿越 */
export function sanitizeSandboxUserPath(p: string): string | null {
  const t = p.trim().replace(/\/+/g, "/");
  if (!t.startsWith("/home/user/") || t.includes("..")) return null;
  if (t.length > MAX_PATH_LEN) return null;
  return t;
}

/** 解析 pip 包名列表（空格或逗号分隔） */
export function parsePipPackages(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const s = raw.trim();
    if (!s || out.length >= MAX_PIP_PACKAGES) break;
    if (/^[a-zA-Z0-9_.\[\]\-]+(?:==[0-9a-zA-Z.*+\-.]+)?$/.test(s)) {
      out.push(s);
    }
  }
  return out;
}

export function parseDownloadPaths(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]+/)) {
    const s = raw.trim();
    if (!s) continue;
    const ok = sanitizeSandboxUserPath(s);
    if (ok && !out.includes(ok)) out.push(ok);
    if (out.length >= 10) break;
  }
  return out;
}

export function totalUtf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function assertUploadBudget(contents: string[]): boolean {
  let sum = 0;
  for (const c of contents) {
    sum += totalUtf8Bytes(c);
    if (sum > MAX_UPLOAD_TOTAL) return false;
  }
  return true;
}
