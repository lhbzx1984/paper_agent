"use client";

import { useCallback, useState } from "react";
import {
  E2bSandboxResultPanel,
  type E2bRunnerResponse,
} from "@/components/e2b-sandbox-result-panel";

const DEFAULT_CODE = `print("Hello from Python")
`;

export function DataLabPythonRunner() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [pipPackages, setPipPackages] = useState("");
  const [downloadPaths, setDownloadPaths] = useState("");
  const [remoteUploadPath, setRemoteUploadPath] = useState(
    "/home/user/uploaded.py",
  );
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [localFileText, setLocalFileText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<E2bRunnerResponse | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const onPickFile = useCallback((file: File | null) => {
    setLocalFileName(null);
    setLocalFileText(null);
    if (!file) return;
    if (file.size > 480_000) {
      setClientError("本地文件过大（上限约 480KB）");
      return;
    }
    setClientError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setLocalFileText(typeof reader.result === "string" ? reader.result : "");
      setLocalFileName(file.name);
    };
    reader.onerror = () => setClientError("读取文件失败");
    reader.readAsText(file, "UTF-8");
  }, []);

  async function run() {
    setClientError(null);
    setLoading(true);
    setResult(null);
    try {
      const uploadFiles =
        localFileText != null && remoteUploadPath.trim()
          ? [{ path: remoteUploadPath.trim(), content: localFileText }]
          : undefined;

      const res = await fetch("/api/data-lab/e2b/run-python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          pipPackages: pipPackages.trim() || undefined,
          downloadPaths: downloadPaths.trim() || undefined,
          uploadFiles,
        }),
      });
      const data = (await res.json()) as E2bRunnerResponse & { error?: string };
      if (!res.ok) {
        setClientError(data.error ?? `请求失败 (${res.status})`);
        setResult(data);
        return;
      }
      setResult(data);
    } catch (e) {
      setClientError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Python 文件与依赖（云端执行）
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          在 E2B 隔离环境中执行：可先上传文本文件到{" "}
          <code className="text-[11px]">/home/user/...</code>
          ，按需{" "}
          <code className="text-[11px]">pip install</code>，运行后在下方下载生成文件。
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          要执行的 Python 代码
        </label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          rows={8}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            上传本地文件（可选，文本 / .py）
          </label>
          <input
            type="file"
            accept=".py,.txt,.md,.json,.yaml,.yml,.csv,.tsv,text/plain"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-xs dark:file:bg-zinc-700"
          />
          {localFileName ? (
            <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
              已选：{localFileName}
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            沙箱内保存路径
          </label>
          <input
            value={remoteUploadPath}
            onChange={(e) => setRemoteUploadPath(e.target.value)}
            placeholder="/home/user/my_script.py"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 font-mono text-xs"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          pip 包（可选，空格或逗号分隔，如{" "}
          <code className="text-[11px]">numpy pandas==2.2</code>）
        </label>
        <input
          value={pipPackages}
          onChange={(e) => setPipPackages(e.target.value)}
          placeholder="numpy pandas"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          执行结束后下载路径（可选，逗号分隔，须位于{" "}
          <code className="text-[11px]">/home/user/</code>）
        </label>
        <input
          value={downloadPaths}
          onChange={(e) => setDownloadPaths(e.target.value)}
          placeholder="/home/user/out.csv, /home/user/plot.png"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 font-mono text-xs"
        />
      </div>

      <button
        type="button"
        onClick={() => void run()}
        disabled={loading || !code.trim()}
        className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
      >
        {loading ? "执行中…" : "在云端执行"}
      </button>

      {clientError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{clientError}</p>
      ) : null}

      <E2bSandboxResultPanel data={result} />
    </div>
  );
}
