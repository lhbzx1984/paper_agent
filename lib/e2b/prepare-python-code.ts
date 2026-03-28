/**
 * 在 E2B 执行前按需注入 `pip install`，部分镜像未预装 Pillow 等包。
 */
export function preparePythonCodeForSandbox(code: string): string {
  const t = code.trim();
  if (!t) return code;
  if (/\bpip\s+install\b/i.test(t)) return t;

  const lines: string[] = [];
  if (/\b(from PIL|import PIL|from PIL\.|import Image\b)/i.test(t)) {
    lines.push(
      "import subprocess, sys",
      'subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pillow"], check=True)',
      "",
    );
  }
  return lines.join("\n") + t;
}
