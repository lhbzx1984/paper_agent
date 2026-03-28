const MIN_LEN = 8;

const SKIP_LANG = new Set([
  "json",
  "yaml",
  "yml",
  "html",
  "xml",
  "css",
  "javascript",
  "js",
  "ts",
  "tsx",
  "jsx",
  "bash",
  "sh",
  "shell",
  "sql",
  "vue",
  "md",
  "markdown",
]);

/** 无 ```python 标签时，根据首行判断围栏内是否像 Python */
function looksLikePython(body: string): boolean {
  const first =
    body.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const s = first.trim();
  if (s.length < 2) return false;
  if (/^[\[{]/.test(s)) return false;
  if (/^(SELECT|INSERT|DELETE|CREATE|DROP|WITH)\b/i.test(s)) return false;
  if (/^(<!DOCTYPE|<html|#include|\{)/i.test(s)) return false;
  return (
    /^(import |from |def |class |#|@|print\(|if |for |while |with |try\b|async def|elif |else:|except|finally:)/.test(
      s,
    ) || /^[\w_][\w\d_]*\s*=/.test(s)
  );
}

function isLikelyPythonLine(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  if (/^```/.test(t)) return false;
  if (
    /^(import |from |def |class |#|@|if |for |while |elif |else|except|try|with |return |print|async |await |raise |pass|break|continue)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/^[ \t]/.test(line)) return true;
  if (/^[\w_][\w\d_.]*\s*=/.test(t)) return true;
  if (/^[\w_][\w\d_.]*\s*\(/.test(t)) return true;
  return /^[\w_][\w\d_.]*\s*\./.test(t);
}

/** 模型常把代码直接贴在正文里（无 ```），从首个 import/from 行起截取 */
function extractUnfencedPython(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i].trim())) continue;
    if (/^\s*(?:import |from )/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```\s*$/.test(line)) break;

    const tr = line.trim();
    if (out.length > 0 && tr === "") {
      const peek = lines
        .slice(i + 1)
        .find((l) => l.trim() !== "" && !/^\s*```/.test(l.trim()));
      if (peek !== undefined && !isLikelyPythonLine(peek)) break;
    }

    out.push(line);
  }

  const body = out.join("\n").trim();
  if (body.length < MIN_LEN) return null;
  return body;
}

/**
 * 从助手 Markdown 中取第一段可执行的 Python：
 * 优先 ```python / ```py，其次无语言或 text/plain 且内容像 Python 的围栏块，最后尝试无围栏的 import/from 起算正文。
 */
export function extractFirstPythonBlock(markdown: string): string | null {
  if (!markdown?.trim()) return null;

  const tagged = /```(?:python|py)\s*\r?\n([\s\S]*?)```/i.exec(markdown);
  const taggedBody = tagged?.[1]?.trim();
  if (taggedBody && taggedBody.length >= MIN_LEN) return taggedBody;

  const re = /```([^\n`]*)\r?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const rawLang = (m[1] ?? "").trim();
    const langKey = rawLang
      ? rawLang.toLowerCase().split(/[-:]/)[0]
      : "";
    const body = (m[2] ?? "").trim();
    if (body.length < MIN_LEN) continue;

    if (langKey === "python" || langKey === "py") return body;
    if (SKIP_LANG.has(langKey)) continue;

    if (
      !rawLang ||
      langKey === "text" ||
      langKey === "plaintext" ||
      langKey === "txt"
    ) {
      if (looksLikePython(body)) return body;
    }
  }

  const unfenced = extractUnfencedPython(markdown);
  if (unfenced) return unfenced;

  return null;
}
