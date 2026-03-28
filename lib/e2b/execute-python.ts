import { Sandbox } from "@e2b/code-interpreter";
import {
  extractE2bImageArtifacts,
  type E2bImageArtifact,
} from "@/lib/e2b/extract-image-artifacts";
import { serializeE2bExecution } from "@/lib/e2b/serialize-execution";
import {
  assertUploadBudget,
  sanitizeSandboxUserPath,
} from "@/lib/e2b/sandbox-extras";

const MAX_CODE_LEN = 96_000;

export type E2bDownloadedFile = {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
  error?: string;
};

export type E2bRunResult = {
  ok: boolean;
  sandboxId?: string;
  payload?: ReturnType<typeof serializeE2bExecution>;
  error?: string;
  imageArtifacts?: E2bImageArtifact[];
  /** pip install 输出（若执行了 pip） */
  pipResult?: { exitCode: number; stdout: string; stderr: string };
  /** runCode 之后从沙箱读取的文件 */
  downloadedFiles?: E2bDownloadedFile[];
};

export type E2bPythonToolResult = {
  ok: boolean;
  toolContent: string;
  imageArtifacts?: E2bImageArtifact[];
};

function truncateForModel(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[输出过长已截断]`;
}

export type RunE2bPythonOpts = {
  code: string;
  apiKey: string;
  userId: string;
  feature: string;
  timeoutMs?: number;
  /** 执行前写入沙箱的文本文件（如 .py），路径须为 /home/user/... */
  uploadFiles?: { path: string; content: string }[];
  /** 执行前 pip install -q … */
  pipPackages?: string[];
  /** runCode 成功后读取这些路径并返回内容 */
  downloadPaths?: string[];
};

/** 创建隔离执行环境、运行 Python、销毁实例；供 HTTP 与 execute_python 工具共用 */
export async function runE2bPython(
  params: RunE2bPythonOpts,
): Promise<E2bRunResult> {
  const trimmed = params.code.slice(0, MAX_CODE_LEN).trim();
  if (!trimmed) {
    return { ok: false, error: "代码为空" };
  }

  const timeoutMs =
    typeof params.timeoutMs === "number" &&
    params.timeoutMs >= 5000 &&
    params.timeoutMs <= 110_000
      ? params.timeoutMs
      : 60_000;

  const uploads = params.uploadFiles ?? [];
  const normalizedUploads: { path: string; content: string }[] = [];
  for (const u of uploads) {
    const p = sanitizeSandboxUserPath(u.path);
    if (!p) {
      return { ok: false, error: `非法上传路径: ${u.path}` };
    }
    normalizedUploads.push({ path: p, content: u.content });
  }
  if (!assertUploadBudget(normalizedUploads.map((u) => u.content))) {
    return { ok: false, error: "上传内容总大小超出限制" };
  }

  const pipList = (params.pipPackages ?? []).filter(Boolean).slice(0, 40);
  const downloadPaths = (params.downloadPaths ?? [])
    .map((p) => sanitizeSandboxUserPath(p))
    .filter((p): p is string => !!p)
    .slice(0, 10);

  let sandbox: InstanceType<typeof Sandbox> | null = null;
  try {
    sandbox = await Sandbox.create({
      apiKey: params.apiKey,
      metadata: { app: "paper_agent", feature: params.feature, uid: params.userId },
      timeoutMs: 300_000,
    });

    for (const { path, content } of normalizedUploads) {
      await sandbox.files.write(path, content);
    }

    let pipResult: E2bRunResult["pipResult"] | undefined;
    if (pipList.length > 0) {
      const cmd = `pip install -q ${pipList.join(" ")}`;
      try {
        const r = await sandbox.commands.run(cmd, {
          timeoutMs: Math.min(180_000, 300_000),
        });
        pipResult = {
          exitCode: r.exitCode,
          stdout: r.stdout,
          stderr: r.stderr,
        };
        if (r.exitCode !== 0) {
          return {
            ok: false,
            error: `pip install 失败 (exit ${r.exitCode}): ${r.stderr || r.stdout || "未知错误"}`,
            pipResult,
            sandboxId: sandbox.sandboxId,
          };
        }
      } catch (e: unknown) {
        const err = e as { exitCode?: number; stdout?: string; stderr?: string; message?: string };
        pipResult = {
          exitCode: err.exitCode ?? -1,
          stdout: err.stdout ?? "",
          stderr: err.stderr ?? String(err.message ?? e),
        };
        return {
          ok: false,
          error: `pip install 失败: ${pipResult.stderr || pipResult.stdout}`,
          pipResult,
          sandboxId: sandbox.sandboxId,
        };
      }
    }

    const execution = await sandbox.runCode(trimmed, {
      timeoutMs,
      requestTimeoutMs: Math.min(timeoutMs + 15_000, 120_000),
    });

    const imageArtifacts = extractE2bImageArtifacts(execution);
    const payload = serializeE2bExecution(execution);

    const downloadedFiles: E2bDownloadedFile[] = [];
    for (const p of downloadPaths) {
      try {
        const isText =
          /\.(py|txt|md|json|yaml|yml|csv|tsv|xml|html|css|js|ts)$/i.test(p);
        if (isText) {
          let text = await sandbox.files.read(p, { format: "text" });
          if (text.length > 400_000) {
            text = `${text.slice(0, 400_000)}\n…[已截断]`;
          }
          downloadedFiles.push({ path: p, encoding: "utf8", content: text });
        } else {
          const bytes = await sandbox.files.read(p, { format: "bytes" });
          const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
          if (view.length > 2_000_000) {
            downloadedFiles.push({
              path: p,
              encoding: "utf8",
              content: "",
              error: "文件过大，已跳过下载（上限约 2MB）",
            });
          } else {
            downloadedFiles.push({
              path: p,
              encoding: "base64",
              content: Buffer.from(view).toString("base64"),
            });
          }
        }
      } catch (e) {
        downloadedFiles.push({
          path: p,
          encoding: "utf8",
          content: "",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      ok: true,
      sandboxId: sandbox.sandboxId,
      payload,
      imageArtifacts,
      pipResult,
      downloadedFiles:
        downloadedFiles.length > 0 ? downloadedFiles : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "E2B 执行失败" };
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch {
        /* noop */
      }
    }
  }
}

/**
 * 供 LLM tool 使用：返回可写入 tool message 的 JSON 字符串（可能截断）。
 */
export async function executePythonInE2bSandbox(params: {
  code: string;
  apiKey: string;
  userId: string;
}): Promise<E2bPythonToolResult> {
  const r = await runE2bPython({
    code: params.code,
    apiKey: params.apiKey,
    userId: params.userId,
    feature: "data_lab_tool",
  });

  if (!r.ok || !r.payload) {
    return {
      ok: false,
      toolContent: JSON.stringify({
        ok: false,
        error: r.error ?? "执行失败",
      }),
    };
  }

  const raw = JSON.stringify({
    ok: true,
    ...r.payload,
  });
  return {
    ok: !r.payload.executionError,
    toolContent: truncateForModel(raw, 14_000),
    imageArtifacts: r.imageArtifacts,
  };
}
