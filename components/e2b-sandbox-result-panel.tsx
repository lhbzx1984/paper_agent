"use client";

import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Package,
  Terminal,
} from "lucide-react";

/** 与 serializeE2bExecution + API 包装一致 */
export type E2bSerializedPayload = {
  text?: string;
  logs?: { stdout?: string[]; stderr?: string[] };
  executionError?: { name?: string; value?: string; traceback?: string };
  results?: Array<{
    text?: string;
    html?: string;
    markdown?: string;
    hasPng?: boolean;
    hasSvg?: boolean;
    hasJpeg?: boolean;
  }>;
};

export type E2bRunnerResponse = E2bSerializedPayload & {
  ok?: boolean;
  error?: string;
  pipResult?: { exitCode: number; stdout: string; stderr: string };
  downloadedFiles?: Array<{
    path: string;
    encoding: "utf8" | "base64";
    content: string;
    error?: string;
  }>;
};

function downloadClientFile(path: string, encoding: string, content: string) {
  const base = path.split("/").pop() || "download";
  if (encoding === "base64") {
    const bin = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
    const blob = new Blob([bin]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = base;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = base;
    a.click();
    URL.revokeObjectURL(url);
  }
}

type PanelVariant = "full" | "chat-append";

type Props = {
  variant?: PanelVariant;
  /** 手动执行 API 的完整 JSON */
  data?: E2bRunnerResponse | null;
  /** 对话里附录的纯文本（与 variant=chat-append 联用） */
  appendPlainText?: string;
};

export function E2bSandboxResultPanel({
  variant = "full",
  data,
  appendPlainText,
}: Props) {
  if (variant === "chat-append" && appendPlainText?.trim()) {
    return (
      <div
        className="data-lab-exec-result mt-3 rounded-xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/50 to-zinc-950/90 overflow-hidden shadow-md ring-1 ring-emerald-500/10"
        role="region"
        aria-label="Python 执行结果"
      >
        <div className="border-b border-emerald-500/25 px-3 py-2 bg-emerald-950/55">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden />
            <span className="text-xs font-semibold text-emerald-50">
              执行结果
            </span>
            <span className="text-[10px] font-normal text-emerald-300/80">
              云端运行返回
            </span>
          </div>
          <p className="mt-1 text-[10px] text-emerald-400/80 leading-snug">
            以下为云端真实执行输出，非模型原文。
          </p>
        </div>
        <pre className="max-h-64 overflow-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed text-emerald-100/90 whitespace-pre-wrap break-words">
          {appendPlainText}
        </pre>
      </div>
    );
  }

  if (variant === "chat-append") {
    return null;
  }

  const d = data;
  if (!d || (!d.error && !d.pipResult && !d.text && !d.logs && !d.executionError && !d.results?.length && !d.downloadedFiles?.length)) {
    return null;
  }

  const stdout = d.logs?.stdout?.join("") ?? "";
  const stderr = d.logs?.stderr?.join("") ?? "";
  const hasPyError = !!d.executionError;
  const pipOk = !d.pipResult || d.pipResult.exitCode === 0;
  const coreOk = !d.error && pipOk && !hasPyError;

  return (
    <div className="space-y-3 mt-3" role="region" aria-label="云端执行结果">
      {/* 总状态 */}
      {d.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2.5 text-sm text-red-100">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div>
            <p className="font-medium">请求或环境错误</p>
            <p className="text-xs mt-1 opacity-95 whitespace-pre-wrap">{d.error}</p>
          </div>
        </div>
      ) : coreOk && stderr ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <span className="font-medium">已执行</span>
          <span className="text-xs text-amber-200/85">（stderr 含输出，见下方）</span>
        </div>
      ) : coreOk ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-950/35 px-3 py-2 text-sm text-emerald-100">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span className="font-medium">代码已执行</span>
          {!stdout && !stderr && !d.text ? (
            <span className="text-xs text-emerald-200/80">（无控制台输出）</span>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <span className="font-medium">执行未完全成功</span>
          <span className="text-xs text-amber-200/80">（见下方详情）</span>
        </div>
      )}

      {d.pipResult ? (
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/25 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-indigo-500/20 px-3 py-2">
            <Package className="h-4 w-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-semibold text-indigo-100">
              pip install
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                d.pipResult.exitCode === 0
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300"
              }`}
            >
              exit {d.pipResult.exitCode}
            </span>
          </div>
          <div className="px-3 py-2 space-y-1 text-xs font-mono max-h-32 overflow-y-auto">
            {d.pipResult.stdout ? (
              <pre className="whitespace-pre-wrap text-zinc-200">{d.pipResult.stdout}</pre>
            ) : null}
            {d.pipResult.stderr ? (
              <pre className="whitespace-pre-wrap text-amber-200/90">{d.pipResult.stderr}</pre>
            ) : null}
            {!d.pipResult.stdout && !d.pipResult.stderr ? (
              <span className="text-zinc-500">（无日志）</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {d.text ? (
        <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400/90 mb-1">
            解释器返回值
          </p>
          <p className="text-sm text-sky-50/95 font-mono whitespace-pre-wrap break-words">
            {d.text}
          </p>
        </div>
      ) : null}

      {stdout ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-950 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1.5">
            <Terminal className="h-3.5 w-3.5 text-green-500" />
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
              stdout
            </span>
          </div>
          <pre className="max-h-48 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-green-400/95 whitespace-pre-wrap">
            {stdout}
          </pre>
        </div>
      ) : null}

      {stderr ? (
        <div className="rounded-xl border border-amber-600/35 bg-amber-950/20 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-amber-700/30 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] font-semibold text-amber-400/90 uppercase tracking-wide">
              stderr
            </span>
          </div>
          <pre className="max-h-40 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-200/90 whitespace-pre-wrap">
            {stderr}
          </pre>
        </div>
      ) : null}

      {d.results && d.results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
            富媒体结果
          </p>
          {d.results.map((r, i) => (
            <div
              key={i}
              className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-3 space-y-2"
            >
              <div className="flex flex-wrap gap-1.5">
                {r.hasPng ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200">
                    <ImageIcon className="h-3 w-3" /> PNG
                  </span>
                ) : null}
                {r.hasSvg ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200">
                    SVG
                  </span>
                ) : null}
                {r.hasJpeg ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200">
                    JPEG
                  </span>
                ) : null}
              </div>
              {r.text ? (
                <p className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">{r.text}</p>
              ) : null}
              {r.markdown ? (
                <div className="markdown-content text-xs text-zinc-300 border-t border-violet-500/20 pt-2 max-h-40 overflow-y-auto">
                  <ReactMarkdown>{r.markdown}</ReactMarkdown>
                </div>
              ) : null}
              {r.html ? (
                <div className="border border-violet-500/20 rounded-lg overflow-hidden bg-white">
                  <iframe
                    title={`result-html-${i}`}
                    sandbox=""
                    className="w-full min-h-[120px] max-h-48"
                    srcDoc={r.html}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {d.executionError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-red-500/30 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs font-semibold text-red-100">Python 异常</span>
          </div>
          <pre className="max-h-48 overflow-auto px-3 py-2.5 text-xs text-red-100/95 whitespace-pre-wrap font-mono">
            {d.executionError.traceback ||
              d.executionError.value ||
              d.executionError.name}
          </pre>
        </div>
      ) : null}

      {d.downloadedFiles && d.downloadedFiles.length > 0 ? (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-3">
          <p className="text-[10px] font-semibold text-cyan-400/90 uppercase tracking-wide mb-2">
            生成的文件
          </p>
          <ul className="flex flex-wrap gap-2">
            {d.downloadedFiles.map((f) => (
              <li key={f.path}>
                {f.error ? (
                  <span className="text-xs text-red-400">
                    {f.path}: {f.error}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      downloadClientFile(f.path, f.encoding, f.content)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1.5 text-xs text-cyan-100 hover:bg-cyan-900/50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {f.path.split("/").pop()}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
