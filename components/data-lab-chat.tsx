"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";
import {
  resolveDataLabModel,
  type DataLabModelMode,
} from "@/lib/data-lab/resolve-model";
import { splitAssistantSandboxAppend } from "@/lib/data-lab/split-assistant-sandbox";
import { buildDataLabUserPayload } from "@/lib/data-lab/csv-attachment";
import { getDataLabChatMarkdownComponents } from "@/components/data-lab-chat-markdown";
import { E2bSandboxResultPanel } from "@/components/e2b-sandbox-result-panel";

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** 本次用户消息是否随附 CSV 文件名（仅展示） */
  csvFileName?: string;
  /** 附带的 CSV 是否在合并前因长度被截断 */
  csvTruncated?: boolean;
  /** Python 执行工具返回的图表等 */
  artifacts?: { kind: "image"; mime: string; src: string }[];
};

const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024;

const SCHEME_IMPORT_KEY = "sra_data_lab_pending_scheme";
const MODEL_MODE_KEY = "sra_data_lab_model_mode";
/** 当前：是否启用 Python 执行工具（execute_python） */
const PYTHON_EXEC_TOOL_KEY = "sra_data_lab_enable_python_exec";
/** 旧版 session 键，首次读取后迁移到 PYTHON_EXEC_TOOL_KEY */
const LEGACY_E2B_TOOLS_KEY = "sra_data_lab_enable_e2b_tools";
const MARKDOWN_VIEW_KEY = "sra_data_lab_markdown_view";

export function DataLabChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const [dataLabMod, setDataLabMod] = useState<LLMModuleConfig | null>(null);
  const [modelMode, setModelMode] = useState<DataLabModelMode>("chat");
  /** 从文献分析「导入」的论文实验与验证设计方案，随每次请求传给系统提示 */
  const [attachedScheme, setAttachedScheme] = useState<string | null>(null);
  /** 是否启用 Python 执行工具 execute_python（默认开） */
  const [enablePythonExecutionTool, setEnablePythonExecutionTool] =
    useState(true);
  /** 对话气泡是否按 Markdown 渲染（默认开） */
  const [markdownView, setMarkdownView] = useState(true);
  /** 待发送的 CSV（仅随下一次用户消息提交至模型） */
  const [pendingCsv, setPendingCsv] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [csvPickError, setCsvPickError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SCHEME_IMPORT_KEY);
      if (raw?.trim()) {
        setAttachedScheme(raw.trim());
        sessionStorage.removeItem(SCHEME_IMPORT_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MODEL_MODE_KEY);
      if (raw === "reasoner" || raw === "chat") {
        setModelMode(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const cur = sessionStorage.getItem(PYTHON_EXEC_TOOL_KEY);
      if (cur === "0") {
        setEnablePythonExecutionTool(false);
        return;
      }
      if (cur === "1") {
        setEnablePythonExecutionTool(true);
        return;
      }
      const legacy = sessionStorage.getItem(LEGACY_E2B_TOOLS_KEY);
      if (legacy === "0") setEnablePythonExecutionTool(false);
      if (legacy === "1") setEnablePythonExecutionTool(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MARKDOWN_VIEW_KEY);
      if (raw === "0") setMarkdownView(false);
      if (raw === "1") setMarkdownView(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((data) => {
        const mod = data.settings?.data_lab as LLMModuleConfig | undefined;
        if (typeof mod !== "object" || !mod) {
          setDataLabMod(null);
          return;
        }
        setDataLabMod(mod);
      })
      .catch(() => {
        setDataLabMod(null);
      });
  }, []);

  useEffect(() => {
    if (!dataLabMod) {
      setModelReady(false);
      return;
    }
    const ok =
      !!(dataLabMod.base_url ?? "").trim() &&
      !!(dataLabMod.api_key ?? "").trim() &&
      !!resolveDataLabModel(dataLabMod, modelMode).trim();
    setModelReady(ok);
  }, [dataLabMod, modelMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const resolvedModel = useMemo(
    () => resolveDataLabModel(dataLabMod, modelMode),
    [dataLabMod, modelMode],
  );

  function setMode(mode: DataLabModelMode) {
    setModelMode(mode);
    try {
      localStorage.setItem(MODEL_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function setPythonExecutionToolEnabled(on: boolean) {
    setEnablePythonExecutionTool(on);
    try {
      sessionStorage.setItem(PYTHON_EXEC_TOOL_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function setMarkdownViewPersist(on: boolean) {
    setMarkdownView(on);
    try {
      localStorage.setItem(MARKDOWN_VIEW_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function onPickCsvFile(f: File | null) {
    setCsvPickError(null);
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".csv")) {
      setCsvPickError("请选择 .csv 文件");
      return;
    }
    if (f.size > MAX_CSV_FILE_BYTES) {
      setCsvPickError("文件过大（上限 5MB）");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result;
      if (typeof raw !== "string") {
        setCsvPickError("无法读取文件内容");
        return;
      }
      setPendingCsv({ name: f.name, text: raw });
    };
    reader.onerror = () => setCsvPickError("读取文件失败");
    reader.readAsText(f, "UTF-8");
  }

  async function send() {
    const text = input.trim();
    if ((!text && !pendingCsv) || loading) return;
    setError(null);
    setCsvPickError(null);
    setInput("");
    const csvForSend = pendingCsv;
    setPendingCsv(null);

    const { content: apiUserContent, csvTruncated } = buildDataLabUserPayload(
      text,
      csvForSend,
    );
    const displayText =
      text || (csvForSend ? "（已上传 CSV，请协助分析）" : "");
    const nextUser: Msg = {
      role: "user",
      content: displayText,
      ...(csvForSend
        ? {
            csvFileName: csvForSend.name,
            csvTruncated: csvTruncated && !!csvForSend,
          }
        : {}),
    };
    setMessages((prev) => [...prev, nextUser]);
    setLoading(true);

    const payloadMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: apiUserContent },
    ];

    try {
      const res = await fetch("/api/agent/data-lab/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
          model: resolvedModel,
          enablePythonExecutionTool,
          ...(attachedScheme ? { schemeContext: attachedScheme } : {}),
        }),
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        const raw = await res.text();
        let err = `请求失败 (${res.status})`;
        try {
          const j = raw ? JSON.parse(raw) : {};
          if (j.error) err = j.error;
        } catch {
          /* noop */
        }
        throw new Error(err);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              content?: string;
              error?: string;
              kind?: string;
              mime?: string;
              base64?: string;
            };
            if (
              ev.type === "artifact" &&
              ev.kind === "image" &&
              typeof ev.mime === "string" &&
              typeof ev.base64 === "string"
            ) {
              const src = `data:${ev.mime};base64,${ev.base64}`;
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy.length - 1;
                if (last >= 0 && copy[last].role === "assistant") {
                  const prevArts = copy[last].artifacts ?? [];
                  copy[last] = {
                    ...copy[last],
                    artifacts: [
                      ...prevArts,
                      { kind: "image" as const, mime: ev.mime!, src },
                    ],
                  };
                }
                return copy;
              });
            }
            if (ev.type === "chunk" && typeof ev.text === "string") {
              assistantText += ev.text;
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy.length - 1;
                if (last >= 0 && copy[last].role === "assistant") {
                  copy[last] = { ...copy[last], content: assistantText };
                }
                return copy;
              });
            }
            if (ev.type === "done" && typeof ev.content === "string") {
              assistantText = ev.content;
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy.length - 1;
                if (last >= 0 && copy[last].role === "assistant") {
                  copy[last] = {
                    ...copy[last],
                    role: "assistant",
                    content: ev.content ?? "",
                  };
                }
                return copy;
              });
            }
            if (ev.type === "error" && ev.error) {
              throw new Error(ev.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
      setMessages((prev) => {
        const copy = [...prev];
        const lastMsg = copy[copy.length - 1];
        if (
          copy.length > 0 &&
          lastMsg?.role === "assistant" &&
          !lastMsg.content &&
          !(lastMsg.artifacts && lastMsg.artifacts.length > 0)
        ) {
          return copy.slice(0, -1);
        }
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
    setPendingCsv(null);
    setCsvPickError(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  function clearAttachedScheme() {
    setAttachedScheme(null);
  }

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden min-h-[480px] max-h-[calc(100vh-12rem)]">
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          与智能体对话，讨论实验设计、统计方法、数据解读与代码思路；若已从文献分析导入实验方案，将优先据此协助代码设计。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearChat}
            disabled={loading || messages.length === 0}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40"
          >
            清空对话
          </button>
          {attachedScheme && (
            <button
              type="button"
              onClick={clearAttachedScheme}
              className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              清除已导入方案
            </button>
          )}
        </div>
      </div>

      {attachedScheme && (
        <div className="px-4 py-2 text-xs text-cyan-800 dark:text-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 border-b border-cyan-200 dark:border-cyan-900/50">
          已加载从文献分析导入的「论文实验与验证设计方案」，智能体将在回复中优先遵循。可随时粘贴或修改下方输入框中的补充说明。
        </div>
      )}

      {modelReady === false && (
        <div className="px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900/50">
          尚未配置本功能所用大模型，或当前模式无可用 model。请前往{" "}
          <Link href="/settings/llm" className="font-medium underline">
            大模型设置
          </Link>{" "}
          ，在「数据实验分析」中填写 base_url、api_key；对话模型填 model（如
          deepseek-chat），深度思考模型可填 model（思考）或留空由 DeepSeek 默认。
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              示例提问
            </p>
            <ul className="text-left max-w-md mx-auto space-y-2">
              <li>• 两组独立样本，正态性不满足时该用什么检验？</li>
              <li>• 做一个 2×2 析因实验，需要注意哪些交互效应？</li>
              <li>• 请用 pandas 读取 CSV 并做描述性统计的示例代码</li>
              <li>• 点击「读取 CSV」上传表格，再提问分析或写处理代码</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => {
          const split =
            m.role === "assistant"
              ? splitAssistantSandboxAppend(m.content || "")
              : { main: m.content || "", sandboxAppend: undefined as string | undefined };
          const hasSandboxAppend = !!split.sandboxAppend;
          const needsOuterPreWrap =
            !markdownView && !(m.role === "assistant" && hasSandboxAppend);

          return (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  needsOuterPreWrap ? "whitespace-pre-wrap" : ""
                } ${
                  m.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {!m.content && loading && i === messages.length - 1 ? (
                  "…"
                ) : hasSandboxAppend ? (
                  <>
                    {split.main.trim() ? (
                      markdownView ? (
                        <div
                          className={`data-lab-chat-md markdown-content text-sm leading-relaxed ${
                            m.role === "user"
                              ? "[&_a]:text-cyan-200 dark:[&_a]:text-blue-800 [&_a]:underline"
                              : ""
                          }`}
                        >
                          <ReactMarkdown
                            components={getDataLabChatMarkdownComponents(m.role)}
                          >
                            {split.main}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{split.main}</span>
                      )
                    ) : null}
                    <E2bSandboxResultPanel
                      variant="chat-append"
                      appendPlainText={split.sandboxAppend}
                    />
                  </>
                ) : markdownView && m.content ? (
                  <div
                    className={`data-lab-chat-md markdown-content text-sm leading-relaxed ${
                      m.role === "user"
                        ? "[&_a]:text-cyan-200 dark:[&_a]:text-blue-800 [&_a]:underline"
                        : ""
                    }`}
                  >
                    <ReactMarkdown
                      components={getDataLabChatMarkdownComponents(m.role)}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
                {m.role === "user" && m.csvFileName && (
                  <p className="mt-2 border-t border-white/15 pt-2 text-[10px] opacity-90 dark:border-zinc-700/60">
                    已附带 CSV：{m.csvFileName}
                    {m.csvTruncated ? "（内容已截断）" : ""}
                  </p>
                )}
                {m.role === "assistant" &&
                  m.artifacts &&
                  m.artifacts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {m.artifacts.map((a, j) =>
                        a.kind === "image" ? (
                          <div
                            key={j}
                            className="rounded-xl border border-zinc-300 dark:border-zinc-600 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm"
                          >
                            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/80">
                              Python 执行图表
                            </div>
                            <img
                              src={a.src}
                              alt=""
                              className="max-w-full max-h-[min(70vh,520px)] object-contain"
                            />
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border-t border-zinc-200 dark:border-zinc-800">
          {error}
        </div>
      )}

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            onPickCsvFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || modelReady === false}
            onClick={() => csvInputRef.current?.click()}
            className="rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            读取 CSV
          </button>
          {pendingCsv && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
              <span className="max-w-[12rem] truncate" title={pendingCsv.name}>
                {pendingCsv.name}
              </span>
              <button
                type="button"
                className="text-emerald-700 underline dark:text-emerald-300"
                onClick={() => {
                  setPendingCsv(null);
                  setCsvPickError(null);
                }}
              >
                移除
              </button>
            </span>
          )}
          <span className="text-[11px] text-zinc-500 dark:text-zinc-500">
            仅随本次发送提交，UTF-8，单文件 ≤5MB
          </span>
        </div>
        {csvPickError && (
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
            {csvPickError}
          </p>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={
              modelReady === false
                ? "请先配置大模型…"
                : "输入问题，Enter 发送，Shift+Enter 换行"
            }
            disabled={loading || modelReady === false}
            rows={3}
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 resize-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={
              loading ||
              (!input.trim() && !pendingCsv) ||
              modelReady === false
            }
            className="self-end rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "生成中…" : "发送"}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            可选工具
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                className="rounded border-zinc-300 dark:border-zinc-600"
                checked={markdownView}
                onChange={(e) => setMarkdownViewPersist(e.target.checked)}
              />
              <span className="font-medium">Markdown 渲染</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                className="rounded border-zinc-300 dark:border-zinc-600"
                checked={enablePythonExecutionTool}
                onChange={(e) => setPythonExecutionToolEnabled(e.target.checked)}
              />
              <span
                className="font-medium"
                title="工具名 execute_python；需在环境变量或数据实验设置中配置 E2B API Key"
              >
                Python 执行工具
              </span>
            </label>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-50/80 dark:bg-zinc-950/40">
            <button
              type="button"
              onClick={() => setMode("chat")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                modelMode === "chat"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              对话模型
            </button>
            <button
              type="button"
              onClick={() => setMode("reasoner")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                modelMode === "reasoner"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              深度思考模型
            </button>
          </div>
          <span
            className="text-[11px] text-zinc-500 dark:text-zinc-500 font-mono truncate max-w-[min(100%,12rem)]"
            title={resolvedModel || ""}
          >
            {resolvedModel || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
