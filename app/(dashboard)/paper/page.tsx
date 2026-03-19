"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { marked } from "marked";

interface SavedPaper {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export default function PaperPage() {
  const [papers, setPapers] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<SavedPaper | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace/papers")
      .then((r) => r.json())
      .then((data) => setPapers(data.papers ?? []))
      .catch(() => setPapers([]));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) loadPaper(id);
  }, []);

  async function loadPaper(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/papers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setSelectedPaper(data.paper);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setSelectedPaper(null);
    } finally {
      setLoading(false);
    }
  }

  const extMap = { markdown: "md", txt: "txt", docx: "docx", latex: "tex", pdf: "pdf" } as const;

  async function handleExport(format: "markdown" | "txt" | "docx" | "latex" | "pdf") {
    if (!selectedPaper?.content) return;
    setExporting(true);
    setError(null);
    try {
      if (format === "pdf") {
        const html2pdf = (await import("html2pdf.js")).default;
        const div = document.createElement("div");
        div.innerHTML = marked.parse(selectedPaper.content) as string;
        div.style.cssText = "padding:24px;font-size:12pt;line-height:1.6;max-width:210mm;font-family:SimSun,serif;";
        document.body.appendChild(div);
        await html2pdf().set({
          margin: 15,
          filename: `${selectedPaper.title || "paper"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        }).from(div).save();
        document.body.removeChild(div);
      } else {
        const res = await fetch("/api/paper/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: selectedPaper.content,
            format,
            title: selectedPaper.title,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "导出失败");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedPaper.title || "paper"}.${extMap[format]}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        论文导出
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        从研究工作台合并保存的论文中选择一篇，导出为 Word、PDF、LaTeX、Markdown 或 TXT 格式
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            选择论文
          </label>
          {papers.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              暂无已保存论文。请先在{" "}
              <Link href="/workspace" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                研究工作台
              </Link>{" "}
              生成各章节并合并保存。
            </p>
          ) : (
            <select
              value={selectedPaper?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) loadPaper(id);
                else setSelectedPaper(null);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">选择要导出的论文...</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {new Date(p.updatedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading && (
          <p className="text-sm text-zinc-500">加载中...</p>
        )}

        {selectedPaper && !loading && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExport("docx")}
                disabled={exporting}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                {exporting ? "导出中..." : "导出 Word"}
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={exporting}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                {exporting ? "导出中..." : "导出 PDF"}
              </button>
              <button
                type="button"
                onClick={() => handleExport("latex")}
                disabled={exporting}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                导出 LaTeX
              </button>
              <button
                type="button"
                onClick={() => handleExport("markdown")}
                disabled={exporting}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                导出 Markdown
              </button>
              <button
                type="button"
                onClick={() => handleExport("txt")}
                disabled={exporting}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                导出 TXT
              </button>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-sans">
                {selectedPaper.content.slice(0, 2000)}
                {selectedPaper.content.length > 2000 ? "\n\n..." : ""}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
