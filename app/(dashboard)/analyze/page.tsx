"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface Project {
  id: string;
  name: string;
}

interface Document {
  id: string;
  name: string;
  size: number;
  mime_type: string | null;
  created_at: string;
}

interface AnalysisResult {
  innovations?: string;
  researchDirections?: string;
  paperStructure?: string;
  experimentAndVerification?: string;
  improvementsOrShortcomings?: string;
  improvementSuggestions?: string;
  paperTitles?: string[];
  selectedTitleIndex?: number;
  paperOutline?: string;
  hintAction?: { type: "clean-and-reupload"; projectId: string };
}

const MODELS = [
  { id: "deepseek-chat", name: "DeepSeek Chat" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
];

const SECTIONS = [
  { key: "innovations", title: "创新点", desc: "挖掘文献中的方法、技术、理论、应用创新", editable: false },
  { key: "researchDirections", title: "研究方向", desc: "提炼可探索的研究空白与未来工作", editable: false },
  { key: "paperStructure", title: "论文结构", desc: "设计适合该领域的新论文框架", editable: false },
  { key: "experimentAndVerification", title: "实验设计与验证", desc: "实验方案与验证方案", editable: false },
  { key: "improvementsOrShortcomings", title: "改进方向与不足", desc: "文献可改进方向与现有不足", editable: true },
  { key: "improvementSuggestions", title: "改进意见与创新点", desc: "基于分析的具体改进建议和创新点", editable: true },
] as const;

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"single" | "multi" | "all">("all");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [model, setModel] = useState("");
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadSavedLoading, setLoadSavedLoading] = useState(false);
  const [hasSaved, setHasSaved] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const outlineAbortRef = useRef<AbortController | null>(null);
  const resultAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) resultAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid) setProjectId(pid);
  }, [searchParams]);

  useEffect(() => {
    if (!projectId) {
      setDocuments([]);
      setDocumentId("");
      setSelectedDocumentIds([]);
      setAnalysisMode("all");
      return;
    }
    setDocsLoading(true);
    setDocumentId("");
    setSelectedDocumentIds([]);
    fetch(`/api/documents?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((data) => {
        const mod = data.settings?.literature_analysis;
        if (typeof mod !== "object" || !mod) {
          setModel("");
          return;
        }
        const base = (mod.base_url ?? "").trim();
        const key = (mod.api_key ?? "").trim();
        const m = (mod.model ?? "").trim();
        if (base && key && m) setModel(m);
        else setModel("");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) {
      setHasSaved(null);
      return;
    }
    const params = new URLSearchParams({ projectId });
    if (analysisMode === "single") {
      const docId = documentId.trim();
      if (!docId) {
        setHasSaved(false);
        return;
      }
      params.set("documentId", docId);
    } else if (analysisMode === "multi") {
      const ids = selectedDocumentIds.map((d) => d.trim()).filter(Boolean);
      if (ids.length === 0) {
        setHasSaved(false);
        return;
      }
      params.set("documentIds", ids.slice().sort().join(","));
    } // all: 不传 documentId/documentIds
    fetch(`/api/analyze/saved?${params}`)
      .then((r) => r.json())
      .then((data) => setHasSaved(!!data?.data))
      .catch(() => setHasSaved(null));
  }, [projectId, analysisMode, documentId, selectedDocumentIds]);

  async function handleAnalyze() {
    if (!projectId) return;
    if (!model.trim()) {
      setError("请先在“大模型设置”中为“文献分析”配置 base_url、api_key 和 model");
      return;
    }
    if (analysisMode === "single" && !documentId.trim()) {
      setError("请选择单篇文献");
      return;
    }
    if (analysisMode === "multi" && selectedDocumentIds.length === 0) {
      setError("请选择要参与综合的文献");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300_000);
    try {
      const payload: {
        projectId: string;
        documentId?: string;
        documentIds?: string[];
        model: string;
        focus?: string;
      } = {
        projectId,
        model,
        focus: focus.trim() || undefined,
      };

      if (analysisMode === "single") {
        payload.documentId = documentId.trim() || undefined;
      } else if (analysisMode === "multi") {
        payload.documentIds = selectedDocumentIds.map((d) => d.trim()).filter(Boolean);
      }

      const res = await fetch("/api/agent/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      if (!res.ok || !res.body) {
        const raw = await res.text();
        let data: { error?: string };
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(`分析失败 (${res.status})`);
        }
        throw new Error(data.error ?? "分析失败");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const partial: AnalysisResult = {};

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
              key?: string;
              text?: string;
              error?: string;
              data?: AnalysisResult;
            };
            if (ev.type === "section" && ev.key && typeof ev.text === "string") {
              (partial as Record<string, string>)[ev.key] = ev.text;
              setResult({ ...partial });
            }
            if (ev.type === "done" && ev.data) {
              setResult(ev.data);
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
      if ((e as Error).name === "AbortError") {
        setError("分析超时，请稍后重试");
      } else {
        setError(e instanceof Error ? e.message : "分析失败");
      }
    } finally {
      setLoading(false);
    }
  }

  function updateEditableField(key: "improvementsOrShortcomings" | "improvementSuggestions", value: string) {
    setResult((prev) => (prev ? { ...prev, [key]: value } : null));
  }

  function updatePaperTitle(index: number, value: string) {
    setResult((prev) => {
      if (!prev) return null;
      const titles = [...(prev.paperTitles ?? [])];
      while (titles.length <= index) titles.push("");
      titles[index] = value;
      return { ...prev, paperTitles: titles };
    });
  }

  async function handleGenerateTitles() {
    if (!model.trim()) {
      setError("请先在“大模型设置”中为“文献分析”配置 base_url、api_key 和 model");
      return;
    }
    if (!result?.improvementSuggestions?.trim()) {
      setError("请先完成分析并填写改进意见与创新点");
      return;
    }
    setTitlesLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          improvementSuggestions: result.improvementSuggestions,
          innovations: result.innovations,
          researchDirections: result.researchDirections,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      setResult((prev) => (prev ? { ...prev, paperTitles: data.titles ?? [] } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setTitlesLoading(false);
    }
  }

  async function handleGenerateOutline() {
    if (!model.trim()) {
      setError("请先在“大模型设置”中为“文献分析”配置 base_url、api_key 和 model");
      return;
    }
    const idx = result?.selectedTitleIndex ?? 0;
    const sel = result?.paperTitles?.[idx]?.trim();
    if (!sel) {
      setError("请先选择并填写论文题目");
      return;
    }
    outlineAbortRef.current?.abort();
    outlineAbortRef.current = new AbortController();
    setOutlineLoading(true);
    setError(null);
    setResult((prev) => (prev ? { ...prev, paperOutline: "" } : null));
    try {
      const res = await fetch("/api/analyze/generate-outline/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedTitle: sel,
          innovations: result?.innovations,
          researchDirections: result?.researchDirections,
          paperStructure: result?.paperStructure,
          experimentAndVerification: result?.experimentAndVerification,
          improvementsOrShortcomings: result?.improvementsOrShortcomings,
          improvementSuggestions: result?.improvementSuggestions,
          model,
        }),
        signal: outlineAbortRef.current.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        const raw = await res.text();
        let data: { error?: string };
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(`生成失败 (${res.status})`);
        }
        throw new Error(data.error ?? "生成失败");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
              outline?: string;
              error?: string;
            };
            if (ev.type === "chunk" && typeof ev.text === "string") {
              setResult((prev) =>
                prev ? { ...prev, paperOutline: (prev.paperOutline ?? "") + ev.text } : null
              );
            }
            if (ev.type === "done" && typeof ev.outline === "string") {
              setResult((prev) => (prev ? { ...prev, paperOutline: ev.outline } : null));
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
      if ((e as Error).name === "AbortError") {
        setError("已中断");
      } else {
        setError(e instanceof Error ? e.message : "生成失败");
      }
    } finally {
      setOutlineLoading(false);
      outlineAbortRef.current = null;
    }
  }

  function handleAbortOutline() {
    outlineAbortRef.current?.abort();
  }

  function handleExportOutline() {
    const outline = result?.paperOutline?.trim();
    if (!outline) return;
    const title = result?.paperTitles?.[result.selectedTitleIndex ?? 0] ?? "论文大纲";
    const blob = new Blob([outline], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.slice(0, 30)}_大纲.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function updatePaperOutline(value: string) {
    setResult((prev) => (prev ? { ...prev, paperOutline: value } : null));
  }

  async function handleLoadSaved() {
    if (!projectId) return;
    setLoadSavedLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId });
      if (analysisMode === "single") {
        if (!documentId.trim()) {
          setError("请选择单篇文献");
          return;
        }
        params.set("documentId", documentId.trim());
      } else if (analysisMode === "multi") {
        const ids = selectedDocumentIds.map((d) => d.trim()).filter(Boolean);
        if (ids.length === 0) {
          setError("请选择要参与综合的文献");
          return;
        }
        params.set("documentIds", ids.slice().sort().join(","));
      }
      const res = await fetch(`/api/analyze/saved?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      if (!data?.data) {
        setError("暂无已保存的分析");
        return;
      }
      const d = data.data;
      setResult({
        innovations: d.innovations ?? "",
        researchDirections: d.researchDirections ?? "",
        paperStructure: d.paperStructure ?? "",
        experimentAndVerification: d.experimentAndVerification ?? "",
        improvementsOrShortcomings: d.improvementsOrShortcomings ?? "",
        improvementSuggestions: d.improvementSuggestions ?? "",
        paperTitles: d.paperTitles ?? [],
        selectedTitleIndex:
          d.selectedTitle != null && Array.isArray(d.paperTitles) && d.paperTitles.length
            ? Math.max(0, d.paperTitles.indexOf(d.selectedTitle))
            : 0,
        paperOutline: d.paperOutline ?? "",
      });
      resultAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadSavedLoading(false);
    }
  }

  async function handleDelete() {
    if (!projectId || !hasSaved) return;
    if (!confirm("确定删除当前选择的已保存分析？此操作不可恢复。")) return;
    setDeleting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId });
      if (analysisMode === "single") {
        if (!documentId.trim()) {
          setError("请选择单篇文献");
          return;
        }
        params.set("documentId", documentId.trim());
      } else if (analysisMode === "multi") {
        const ids = selectedDocumentIds.map((d) => d.trim()).filter(Boolean);
        if (ids.length === 0) {
          setError("请选择要参与综合的文献");
          return;
        }
        params.set("documentIds", ids.slice().sort().join(","));
      }
      const res = await fetch(`/api/analyze/saved?${params}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "删除失败");
      setResult(null);
      setHasSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!result || !projectId) return;
    if (analysisMode === "single" && !documentId.trim()) {
      setError("请选择单篇文献");
      return;
    }
    if (analysisMode === "multi" && selectedDocumentIds.length === 0) {
      setError("请选择要参与综合的文献");
      return;
    }
    setSaving(true);
    setSaveSuccess(false);
    try {
      const selectedDocs = (() => {
        if (analysisMode === "single") {
          const d = documents.find((x) => x.id === documentId.trim());
          return d ? [d] : [];
        }
        if (analysisMode === "multi") {
          const idSet = new Set(selectedDocumentIds);
          return documents.filter((d) => idSet.has(d.id));
        }
        return [];
      })();

      const documentName = (() => {
        if (analysisMode === "all") return "全部文档";
        if (analysisMode === "single") return selectedDocs[0]?.name ?? "单篇文献";
        const names = selectedDocs.map((d) => d.name).filter(Boolean);
        return `多篇：${names.slice(0, 6).join("，")}${names.length > 6 ? "…" : ""}`;
      })();

      const documentIds =
        analysisMode === "multi"
          ? selectedDocumentIds.map((d) => d.trim()).filter(Boolean)
          : undefined;

      const docIdForSave = analysisMode === "single" ? documentId.trim() || null : null;

      const res = await fetch("/api/analyze/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          documentId: analysisMode === "all" ? null : docIdForSave,
          documentIds,
          documentName,
          innovations: result.innovations,
          researchDirections: result.researchDirections,
          paperStructure: result.paperStructure,
          experimentAndVerification: result.experimentAndVerification,
          improvementsOrShortcomings: result.improvementsOrShortcomings,
          improvementSuggestions: result.improvementSuggestions,
          paperTitles: result.paperTitles,
          selectedTitle: result.paperTitles?.[result.selectedTitleIndex ?? 0] ?? null,
          paperOutline: result.paperOutline,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          文献分析
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          分析选中文献的创新点、研究方向、论文结构、实验设计与验证、改进方向与不足、改进意见与创新点。改进方向与不足、改进意见与创新点可编辑并保存，供研究工作台调用
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            选择知识库
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
          >
            <option value="">请选择知识库</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {projects.length === 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              <Link href="/projects" className="text-cyan-600 hover:underline">
                新建项目
              </Link>{" "}
              并在知识库中上传文献后可进行分析
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            分析范围
          </label>
          <select
            value={analysisMode}
            onChange={(e) => {
              const v = e.target.value as "single" | "multi" | "all";
              setAnalysisMode(v);
              setError(null);
              if (v === "single") setSelectedDocumentIds([]);
              if (v === "multi") setDocumentId("");
            }}
            disabled={!projectId}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
          >
            <option value="all">知识库整体（全部文档）</option>
            <option value="single">单篇文献</option>
            <option value="multi">多篇文献综合</option>
          </select>
        </div>

        {projectId && analysisMode === "single" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              选择单篇文献
            </label>
            <select
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              disabled={docsLoading}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">请选择单篇文献</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {docsLoading
                ? "加载文档列表中..."
                : documents.length === 0
                  ? "该知识库暂无文档，请 "
                  : "选择单篇文献可针对该文献进行深度分析"}
              {documents.length === 0 && !docsLoading && (
                <Link
                  href={`/upload?projectId=${projectId}`}
                  className="text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  前往知识库上传
                </Link>
              )}
            </p>
          </div>
        )}

        {projectId && analysisMode === "multi" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              选择多篇文献（参与综合）
            </label>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedDocumentIds(documents.map((d) => d.id))}
                disabled={docsLoading || documents.length === 0}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => setSelectedDocumentIds([])}
                disabled={docsLoading}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                清空
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2">
              {docsLoading ? (
                <p className="text-xs text-zinc-500">加载中...</p>
              ) : documents.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  暂无文档，请{" "}
                  <Link
                    href={`/upload?projectId=${projectId}`}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    前往上传
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((d) => {
                    const checked = selectedDocumentIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedDocumentIds, d.id]
                              : selectedDocumentIds.filter((id) => id !== d.id);
                            setSelectedDocumentIds(next);
                          }}
                          className="shrink-0"
                        />
                        <span className="truncate">{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {selectedDocumentIds.length > 0
                ? `已选择 ${selectedDocumentIds.length} 篇文献`
                : "至少选择 1 篇文献后才能开始分析"}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            分析焦点（可选）
          </label>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="例如：Transformer、医学影像分割、强化学习"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500">
            留空则基于全文检索；填写后优先检索相关片段
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            大模型
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
            disabled={!model.trim()}
          >
            {!model.trim() ? (
              <option value="">未配置（请先去“大模型设置”）</option>
            ) : (
              <option value={model}>
                {MODELS.find((m) => m.id === model)?.name ?? model}
              </option>
            )}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAnalyze}
            disabled={
              loading ||
              !projectId ||
              !model.trim() ||
              (analysisMode === "single" && !documentId.trim()) ||
              (analysisMode === "multi" && selectedDocumentIds.length === 0)
            }
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "分析中..." : "开始分析"}
          </button>
          <button
            onClick={handleLoadSaved}
            disabled={loadSavedLoading || !projectId || !hasSaved}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-6 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {loadSavedLoading ? "加载中..." : "加载已保存分析"}
          </button>
          {hasSaved && (
            <button
              onClick={handleDelete}
              disabled={deleting || !projectId}
              className="rounded-lg border border-red-300 dark:border-red-700 px-6 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
            >
              {deleting ? "删除中..." : "删除分析"}
            </button>
          )}
        </div>
        {hasSaved && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            当前选择有已保存的分析，可点击「加载已保存分析」查看或编辑
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {(result || loading) && (
        <div ref={resultAreaRef} className="space-y-6">
          {result?.hintAction?.type === "clean-and-reupload" && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
              <Link
                href={`/upload?projectId=${result.hintAction.projectId}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
              >
                前往知识库清理无内容文档并重新上传 →
              </Link>
            </div>
          )}
          {SECTIONS.map(({ key, title, desc, editable }) => {
            const content = result?.[key as keyof AnalysisResult];
            const hasContent = content && typeof content === "string";
            const isLoading = loading && !hasContent;
            const isEditable = editable && (key === "improvementsOrShortcomings" || key === "improvementSuggestions");
            return (
              <div
                key={key}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
              >
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-1">
                  {title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  {desc}
                </p>
                {isLoading ? (
                  <div className="flex items-center gap-2 py-4 text-zinc-500 dark:text-zinc-400">
                    <div className="animate-spin h-4 w-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
                    <span className="text-sm">并行分析中…</span>
                  </div>
                ) : hasContent ? (
                  isEditable ? (
                    <textarea
                      value={content}
                      onChange={(e) => updateEditableField(key as "improvementsOrShortcomings" | "improvementSuggestions", e.target.value)}
                      rows={8}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 markdown-content"
                    />
                  ) : (
                    <div className="markdown-content text-sm text-zinc-600 dark:text-zinc-400 max-h-64 overflow-y-auto">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  )
                ) : null}
              </div>
            );
          })}
          {result && !loading && (
            <>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-1">
                  论文题目（1-5 个，可编辑）
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  根据改进意见与创新点生成，可编辑后选择最终题目
                </p>
                <div className="space-y-2 mb-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="selectedTitle"
                        id={`title-${i}`}
                        checked={(result.selectedTitleIndex ?? 0) === i}
                        onChange={() =>
                          setResult((prev) =>
                            prev ? { ...prev, selectedTitleIndex: i } : null
                          )
                        }
                        className="shrink-0"
                      />
                      <input
                        type="text"
                        value={result.paperTitles?.[i] ?? ""}
                        onChange={(e) => updatePaperTitle(i, e.target.value)}
                        placeholder={`题目 ${i + 1}`}
                        className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleGenerateTitles}
                  disabled={titlesLoading || !model.trim() || !result.improvementSuggestions?.trim()}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {titlesLoading ? "生成中..." : "生成论文题目"}
                </button>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-1">
                  论文大纲
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  选择论文题目后生成，支持流式输出、中断、导出与编辑
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={handleGenerateOutline}
                    disabled={
                      outlineLoading || !model.trim() || !(
                        result.paperTitles?.[result.selectedTitleIndex ?? 0]?.trim()
                      )
                    }
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {outlineLoading ? "生成中..." : "生成论文大纲"}
                  </button>
                  {outlineLoading && (
                    <button
                      type="button"
                      onClick={handleAbortOutline}
                      className="rounded-lg border border-red-300 dark:border-red-700 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      中断
                    </button>
                  )}
                  {result.paperOutline && !outlineLoading && (
                    <button
                      type="button"
                      onClick={handleExportOutline}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      导出
                    </button>
                  )}
                </div>
                {(result.paperOutline !== undefined || outlineLoading) && (
                  <textarea
                    value={result.paperOutline ?? ""}
                    onChange={(e) => updatePaperOutline(e.target.value)}
                    placeholder={outlineLoading ? "生成中，可点击「中断」停止..." : "论文大纲内容，支持 Markdown"}
                    rows={16}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 font-mono whitespace-pre-wrap"
                    disabled={outlineLoading}
                  />
                )}
              </div>
            </>
          )}
          {result && !loading && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-cyan-600 dark:bg-cyan-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 dark:hover:bg-cyan-600 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存分析结果"}
              </button>
              {saveSuccess && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400">已保存，研究工作台可调用</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
          加载中...
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
