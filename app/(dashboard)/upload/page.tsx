"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description?: string | null;
}

function KnowledgeBaseSelect() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          知识库
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          选择知识库以管理文档（上传、下载）
        </p>
      </div>
      {loading ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
          加载中...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">暂无知识库</p>
          <p className="mt-2 text-sm text-zinc-400">
            请先在项目管理中创建项目，每个项目对应一个知识库
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-block text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            前往项目管理 →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/upload?projectId=${p.id}`}
              className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                {p.name}
              </h3>
              {p.description && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {p.description}
                </p>
              )}
              <span className="mt-2 inline-block text-sm text-cyan-600 dark:text-cyan-400">
                文档管理 →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface Document {
  id: string;
  name: string;
  size: number;
  mime_type: string | null;
  created_at: string;
}

interface ProjectDetail {
  id: string;
  name: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PaperResult {
  paperId?: string;
  title?: string;
  authors?: string[] | { name?: string }[];
  year?: number;
  abstract?: string;
  citationCount?: number;
  doi?: string;
  url?: string;
  externalIds?: { DOI?: string; ArXiv?: string; PubMed?: string };
  [key: string]: unknown;
}

type SearchMode = "keyword" | "title" | "id";

function PaperSearchSection({
  projectId,
  onAddToKb,
}: {
  projectId: string | null;
  onAddToKb?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [mode, setMode] = useState<SearchMode>("keyword");
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PaperResult[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [creditsInfo, setCreditsInfo] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [detailPaperId, setDetailPaperId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaperResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addingToKb, setAddingToKb] = useState<string | null>(null);
  const [addToKbError, setAddToKbError] = useState<string | null>(null);
  const [addToKbSuccess, setAddToKbSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function fetchPage(pageNum: number, isNewSearch = false) {
    if (!query.trim()) return;
    setLoading(true);
    if (isNewSearch) {
      setSearchError(null);
      setCreditsInfo(null);
      setDetailPaperId(null);
      setDetail(null);
      setAddToKbError(null);
    }
    try {
      const params: Record<string, string> = {
        query: query.trim(),
        limit: String(pageSize),
        offset: String((pageNum - 1) * pageSize),
        mode,
      };
      if (year) params.year = year;
      if (openAccessOnly) params.openAccessOnly = "1";
      const res = await fetch(`/api/paper/search?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "检索失败");
      setResults(data.data ?? []);
      setTotal(data.total ?? 0);
      setPage(pageNum);
      const parts: string[] = [];
      if (data.creditsRemaining != null) parts.push(`剩余积分: ${data.creditsRemaining}`);
      if (data.creditsCharged != null) parts.push(`本次消耗: ${data.creditsCharged}`);
      if (parts.length) setCreditsInfo(parts.join(" · "));
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "检索失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setResults([]);
    setTotal(null);
    await fetchPage(1, true);
  }

  // API 最大 offset 约 10000，最多可浏览前 1000 页（每页 10 条）
  const maxOffset = 9990;
  const maxPage = Math.floor(maxOffset / pageSize) + 1;
  const totalPages =
    total != null
      ? Math.max(1, Math.min(Math.ceil(total / pageSize), maxPage))
      : 0;
  const showPagination = total != null && total > pageSize && mode === "keyword";

  async function openDetail(paper: PaperResult) {
    const id = paper.paperId ?? paper.externalIds?.DOI ?? paper.doi;
    if (!id) return;
    setDetailPaperId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/paper/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setDetail(data.data ?? null);
    } catch {
      setDetail(paper);
    } finally {
      setDetailLoading(false);
    }
  }

  function authorNames(authors: PaperResult["authors"]): string {
    if (!authors?.length) return "";
    return authors
      .map((a) => (typeof a === "object" && a?.name ? a.name : String(a)))
      .filter(Boolean)
      .join(", ");
  }

  async function handleAddToKb(paper: PaperResult) {
    const id = paper.paperId ?? paper.externalIds?.DOI ?? paper.doi;
    if (!id || !projectId) return;
    setAddingToKb(id);
    setAddToKbError(null);
    setAddToKbSuccess(null);
    try {
      const res = await fetch("/api/paper/add-to-kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: id, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "添加失败");
      setAddToKbSuccess(`已添加 ${data.chunks ?? 0} 个文档块到知识库`);
      onAddToKb?.();
    } catch (e) {
      setAddToKbError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setAddingToKb(null);
    }
  }

  const placeholders: Record<SearchMode, string> = {
    keyword: "例如：machine learning, transformer...",
    title: "输入论文标题进行精确匹配",
    id: "paperId、DOI、arXiv ID 或 PMID",
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">
        论文检索
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        支持关键词、标题匹配、ID/DOI/ArXiv 多种检索方式，检索后可添加到知识库
      </p>
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-4">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SearchMode)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
          disabled={loading}
        >
          <option value="keyword">关键词</option>
          <option value="title">标题匹配</option>
          <option value="id">ID/DOI/ArXiv</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholders[mode]}
          className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          disabled={loading}
        />
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
          disabled={loading}
        >
          <option value="">不限年份</option>
          {[2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
            <option key={y} value={String(y)}>
              {y} 年
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={openAccessOnly}
            onChange={(e) => setOpenAccessOnly(e.target.checked)}
            disabled={loading}
          />
          仅开放获取
        </label>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? "检索中..." : "检索"}
        </button>
      </form>
      {creditsInfo && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{creditsInfo}</p>
      )}
      {addToKbSuccess && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 mb-4">
          {addToKbSuccess}
        </div>
      )}
      {addToKbError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400 mb-4">
          {addToKbError}
        </div>
      )}
      {searchError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400 mb-4">
          {searchError}
        </div>
      )}
      {total != null && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            找到 {total} 篇论文
            {total > 0 &&
              `，当前第 ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} 篇`}
          </p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {results.map((paper, i) => {
              const id = paper.paperId ?? paper.externalIds?.DOI ?? paper.doi ?? i;
              const paperId = paper.paperId ?? paper.externalIds?.DOI ?? paper.doi;
              const names = authorNames(paper.authors);
              const isAdding = paperId && addingToKb === paperId;
              return (
                <li
                  key={String(id)}
                  className="py-3 first:pt-0 flex items-start justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => openDetail(paper)}
                    className="flex-1 min-w-0 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  >
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {paper.title ?? "(无标题)"}
                    </p>
                    {(names || paper.year || paper.citationCount != null) && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {names}
                        {paper.year ? ` · ${paper.year}` : ""}
                        {paper.citationCount != null ? ` · 引用 ${paper.citationCount}` : ""}
                      </p>
                    )}
                    {paper.abstract && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                        {paper.abstract}
                      </p>
                    )}
                  </button>
                  {projectId && paperId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToKb(paper);
                      }}
                      disabled={!!isAdding}
                      className="shrink-0 rounded-lg border border-cyan-600 dark:border-cyan-400 px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 disabled:opacity-50"
                    >
                      {isAdding ? "添加中..." : "添加到知识库"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {showPagination && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => fetchPage(1)}
                disabled={loading || page <= 1}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                首页
              </button>
              <button
                type="button"
                onClick={() => fetchPage(page - 1)}
                disabled={loading || page <= 1}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                第 {page} / {totalPages} 页
              </span>
              <button
                type="button"
                onClick={() => fetchPage(page + 1)}
                disabled={loading || page >= totalPages}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
              <button
                type="button"
                onClick={() => fetchPage(totalPages)}
                disabled={loading || page >= totalPages}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                末页
              </button>
            </div>
          )}
        </div>
      )}

      {/* 论文详情弹窗 */}
      {detailPaperId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailPaperId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="paper-detail-title"
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 id="paper-detail-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                论文详情
              </h3>
              <button
                type="button"
                onClick={() => setDetailPaperId(null)}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            {detailLoading ? (
              <p className="mt-4 text-zinc-500">加载中...</p>
            ) : detail ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {(detail as PaperResult).title ?? "(无标题)"}
                  </h4>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {authorNames((detail as PaperResult).authors)}
                    {(detail as PaperResult).year ? ` · ${(detail as PaperResult).year}` : ""}
                    {(detail as PaperResult).citationCount != null
                      ? ` · 引用 ${(detail as PaperResult).citationCount}`
                      : ""}
                  </p>
                </div>
                {(detail as PaperResult).abstract && (
                  <div>
                    <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">摘要</h5>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {(detail as PaperResult).abstract}
                    </p>
                  </div>
                )}
                {((detail as PaperResult).url ?? (detail as PaperResult).doi) && (
                  <a
                    href={
                      (detail as PaperResult).url ??
                      `https://doi.org/${(detail as PaperResult).doi}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    查看原文 →
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-4 text-zinc-500">无法加载详情</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ chunks: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    fetch("/api/projects")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError((data as { error?: string }).error ?? "加载项目失败");
          setProject(null);
          return;
        }
        const p = (data.projects ?? []).find((x: ProjectDetail) => x.id === projectId);
        setProject(p ?? null);
        setError(p ? null : "项目不存在或无权访问");
      })
      .catch(() => {
        setProject(null);
        setError("加载失败");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setDocsLoading(true);
    fetch(`/api/documents?projectId=${projectId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setDocuments([]);
          return;
        }
        setDocuments(data.documents ?? []);
      })
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, [projectId, uploadResult]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !projectId) return;
    setError(null);
    setUploadResult(null);
    setUploading(true);

    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowed.includes(file.type) && !file.name.endsWith(".txt")) {
        setError(`不支持格式: ${file.name}`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const raw = await res.text();
        let data: { error?: string; id?: string; chunks?: number };
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(res.ok ? "响应格式异常" : `上传失败 (${res.status})`);
        }
        if (!res.ok) throw new Error(data.error ?? "上传失败");
        setUploadResult({ chunks: data.chunks ?? 0 });
        setDocuments((prev) => [
          {
            id: data.id!,
            name: file.name,
            size: file.size,
            mime_type: file.type,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "上传失败");
      }
    }

    setUploading(false);
  }

  async function handleCleanEmpty() {
    if (!projectId) return;
    setCleaning(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/clean-empty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "清理失败");
      if (data.deleted > 0) {
        const listRes = await fetch(`/api/documents?projectId=${projectId}`);
        const listData = await listRes.json();
        setDocuments(listData.documents ?? []);
        setUploadResult(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "清理失败");
    } finally {
      setCleaning(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("确定删除该文档？")) return;
    setDeletingId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "删除失败");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  if (!projectId) {
    return <KnowledgeBaseSelect />;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
        加载中...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          {error ?? "项目不存在或无权访问"}
        </p>
        <Link
          href="/upload"
          className="mt-4 inline-block text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          返回知识库列表 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            知识库
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            当前：{project.name}
            <Link
              href="/upload"
              className="ml-2 text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              切换知识库
            </Link>
            {" · "}
            <Link
              href={`/analyze?projectId=${projectId}`}
              className="text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              文献分析
            </Link>
          </p>
        </div>
      </div>

      <PaperSearchSection
        projectId={projectId}
        onAddToKb={async () => {
          const res = await fetch(`/api/documents?projectId=${projectId}`);
          const data = await res.json();
          if (res.ok) setDocuments(data.documents ?? []);
        }}
      />

      <div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">
          文档管理
        </h3>

        <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          multiple
          className="hidden"
          id="file-upload"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {uploading ? (
            "上传中..."
          ) : (
            <>
              拖拽文件到此处，或 <span className="text-cyan-600">点击选择</span>
              <br />
              <span className="text-sm">支持 PDF、Word、TXT</span>
            </>
          )}
        </label>
        {uploadResult && (
          <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
            已解析 {uploadResult.chunks} 个文档块，已入库
          </p>
        )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
            已上传文档
          </h4>
          {documents.length > 0 && (
            <button
              type="button"
              onClick={handleCleanEmpty}
              disabled={cleaning}
              className="text-sm text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
            >
              {cleaning ? "清理中..." : "清理无内容文档"}
            </button>
          )}
        </div>
        {docsLoading ? (
          <p className="text-zinc-500">加载中...</p>
        ) : documents.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">
            暂无文档，上传后将在此展示
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                  {d.name}
                </span>
                <span className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-sm text-zinc-500">
                    {formatSize(d.size)} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("zh-CN")}
                  </span>
                  <a
                    href={`/api/documents/${d.id}/download`}
                    download
                    className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    下载
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(d.id)}
                    disabled={deletingId === d.id}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    {deletingId === d.id ? "删除中" : "删除"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
          加载中...
        </div>
      }
    >
      <UploadContent />
    </Suspense>
  );
}
