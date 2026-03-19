"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Skill {
  id: string;
  name: string;
  description?: string | null;
  type?: "builtin" | "custom";
}

interface OutlineItem {
  id: string;
  documentName: string;
  selectedTitle: string | null;
  paperOutline: string;
  updatedAt: string;
}

interface OutlineSection {
  id: string;
  title: string;
  fullText: string;
  /** 层级深度，用于缩进显示：1=4.1, 2=4.1.1 */
  level: number;
}

const MODELS = [
  { id: "deepseek-chat", name: "DeepSeek Chat" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
];

/** 解析大纲：支持 ##/### 标题、4.1/4.1.1 编号、允许前导空格和列表符号 */
function parseOutline(markdown: string): OutlineSection[] {
  const sections: OutlineSection[] = [];
  const lines = markdown.split("\n");
  const items: { title: string; lines: string[]; level: number }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const mdMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    // 匹配 4、4.1、4.1.1 等格式，允许前导 - * · 和 4. 4、4.1 等分隔
    const numMatch = trimmed.match(/^[-*·\s]*(\d+(?:[.．]\d+)*)[.．、\s]*(.+)$/);

    if (mdMatch) {
      const level = mdMatch[1].length;
      const title = mdMatch[2].trim();
      if (items.length) {
        items[items.length - 1].lines = items[items.length - 1].lines.filter(Boolean);
      }
      items.push({ title, lines: [], level });
    } else if (numMatch) {
      const numPart = numMatch[1].replace(/．/g, ".");
      const level = numPart.split(".").length;
      const title = trimmed.replace(/^[-*·\s]+/, "").trim();
      if (items.length) {
        items[items.length - 1].lines = items[items.length - 1].lines.filter(Boolean);
      }
      items.push({ title, lines: [], level });
    } else if (items.length > 0) {
      items[items.length - 1].lines.push(line);
    }
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const fullText = [it.title, ...it.lines].join("\n").trim();
    sections.push({
      id: `s${i}`,
      title: it.title.split("\n")[0].trim(),
      fullText: fullText || it.title,
      level: it.level,
    });
  }

  if (sections.length === 0 && markdown.trim()) {
    sections.push({
      id: "s0",
      title: "全文",
      fullText: markdown.trim(),
      level: 1,
    });
  }
  return sections;
}

export default function WorkspacePage() {
  const [model, setModel] = useState("deepseek-chat");
  const [maxLengthSelect, setMaxLengthSelect] = useState("3000");
  const [customMaxLength, setCustomMaxLength] = useState(5000);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const PRESET_LENGTHS = [1500, 3000, 5000, 8000, 12000, 20000];
  const effectiveMaxLength =
    maxLengthSelect === "custom"
      ? Math.min(Math.max(customMaxLength, 500), 20000)
      : Number(maxLengthSelect) || 3000;
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [outlineSource, setOutlineSource] = useState<"import" | "upload">("import");
  const [outlineList, setOutlineList] = useState<OutlineItem[]>([]);
  const [selectedOutlineId, setSelectedOutlineId] = useState("");
  const [uploadedOutline, setUploadedOutline] = useState("");
  const [fullOutline, setFullOutline] = useState("");
  const [sections, setSections] = useState<OutlineSection[]>([]);
  const [savedSections, setSavedSections] = useState<Record<string, string>>({});
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [savedPapers, setSavedPapers] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [mergeTitle, setMergeTitle] = useState("");
  const [savingMerge, setSavingMerge] = useState(false);
  const resultAreaRef = useRef<HTMLDivElement>(null);

  function fetchSavedPapers() {
    fetch("/api/workspace/papers")
      .then((r) => r.json())
      .then((data) => setSavedPapers(data.papers ?? []))
      .catch(() => setSavedPapers([]));
  }

  useEffect(() => {
    fetchSavedPapers();
  }, []);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => setAvailableSkills(data.skills ?? []))
      .catch(() => setAvailableSkills([]));
  }, []);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((data) => {
        const mod = data.settings?.workspace;
        const m = typeof mod === "object" ? mod?.model : mod;
        if (m) setModel(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/analyze/outlines")
      .then((r) => r.json())
      .then((data) => setOutlineList(data.outlines ?? []))
      .catch(() => setOutlineList([]));
  }, []);

  function loadOutline(text: string) {
    setFullOutline(text);
    setSections(parseOutline(text));
    setSelectedSectionId(null);
    setGeneratedContent("");
  }

  function handleOutlineChange(value: string) {
    setFullOutline(value);
    setSections(parseOutline(value));
    setSelectedSectionId(null);
  }

  function handleImportOutline() {
    if (!selectedOutlineId) return;
    const item = outlineList.find((o) => o.id === selectedOutlineId);
    if (!item?.paperOutline) return;
    loadOutline(item.paperOutline);
  }

  function handleUploadOutline(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setUploadedOutline(text);
      loadOutline(text);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  function handleGenerateSection() {
    const section = sections.find((s) => s.id === selectedSectionId);
    if (!section || !fullOutline) return;
    setError(null);
    abortController?.abort();
    const ctrl = new AbortController();
    setAbortController(ctrl);
    setGeneratingSectionId(section.id);
    setGeneratedContent("");

    const prevIndex = sections.findIndex((s) => s.id === section.id);
    const previousSections = sections
      .slice(0, prevIndex)
      .map((s) => ({
        section: s.title,
        content: savedSections[s.id] ?? "",
      }))
      .filter((p) => p.content);

    fetch("/api/agent/workspace/generate-section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outlineSection: section.fullText,
        sectionIndex: prevIndex,
        previousSections,
        fullOutline,
        skillIds: selectedSkillIds,
        model,
        maxLength: effectiveMaxLength,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error("生成失败");
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
                content?: string;
                error?: string;
              };
              if (ev.type === "chunk" && ev.text)
                setGeneratedContent((prev) => prev + ev.text);
              if (ev.type === "done" && ev.content)
                setGeneratedContent(ev.content);
              if (ev.type === "error" && ev.error) throw new Error(ev.error);
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "生成失败");
        }
      })
      .finally(() => {
        setGeneratingSectionId(null);
        setAbortController(null);
      });
  }

  function handleSaveSection() {
    if (!selectedSectionId || !generatedContent.trim()) return;
    setSavedSections((prev) => ({ ...prev, [selectedSectionId]: generatedContent.trim() }));
  }

  function handleDeleteSection() {
    if (!selectedSectionId) return;
    if (!confirm("确定删除该章节的已保存内容？")) return;
    setSavedSections((prev) => {
      const next = { ...prev };
      delete next[selectedSectionId];
      return next;
    });
    setGeneratedContent("");
  }

  function getMergedContent(): string {
    return sections
      .map((s) => {
        const content = savedSections[s.id];
        if (!content) return null;
        return `## ${s.title}\n\n${content}`;
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
  }

  function handleExportFull() {
    const full = getMergedContent();
    if (!full) return;
    const blob = new Blob([full], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "论文正文.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleMergeSave() {
    const content = getMergedContent();
    if (!content.trim()) {
      setError("请先保存各章节内容后再合并");
      return;
    }
    setError(null);
    setSavingMerge(true);
    try {
      const res = await fetch("/api/workspace/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mergeTitle.trim() || "未命名论文",
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setMergeTitle("");
      fetchSavedPapers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingMerge(false);
    }
  }

  function handleLoadPaper(id: string) {
    window.location.href = `/paper?id=${id}`;
  }

  async function handleDeletePaper(id: string) {
    if (!confirm("确定删除该论文？")) return;
    try {
      const res = await fetch(`/api/workspace/papers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      fetchSavedPapers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }

  function handleSelectSection(id: string) {
    setSelectedSectionId(id);
    setGeneratedContent(savedSections[id] ?? "");
  }

  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const isGenerating = !!generatingSectionId;

  const SECTION_COLORS = [
    "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700",
    "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700",
    "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
    "bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700",
    "bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700",
    "bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700",
  ];

  function toggleSectionExpand(id: string) {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        研究工作台
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        导入论文大纲，关联技能，按写作顺序分步生成论文。生成内容可保存、修改、删除后继续生成后续章节
      </p>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            导入论文大纲
          </label>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="outlineSource"
                checked={outlineSource === "import"}
                onChange={() => setOutlineSource("import")}
              />
              从文献分析导入
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="outlineSource"
                checked={outlineSource === "upload"}
                onChange={() => setOutlineSource("upload")}
              />
              上传 Markdown
            </label>
          </div>
          {outlineSource === "import" && (
            <div className="flex gap-2">
              <select
                value={selectedOutlineId}
                onChange={(e) => setSelectedOutlineId(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">选择已保存的大纲...</option>
                {outlineList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.selectedTitle || o.documentName || "未命名"} · {new Date(o.updatedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleImportOutline}
                disabled={!selectedOutlineId}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
              >
                导入
              </button>
            </div>
          )}
          {outlineSource === "upload" && (
            <div>
              <input
                type="file"
                accept=".md,.markdown,.txt"
                onChange={handleUploadOutline}
                className="block w-full text-sm text-zinc-600 dark:text-zinc-400"
              />
            </div>
          )}
          {outlineList.length === 0 && outlineSource === "import" && (
            <p className="mt-1 text-xs text-zinc-500">
              <Link href="/analyze" className="text-cyan-600 hover:underline">
                前往文献分析
              </Link>{" "}
              生成并保存论文大纲后可在此导入
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            关联技能
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedSkillIds.map((id) => {
              const s = availableSkills.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-200 dark:bg-zinc-700 px-3 py-1 text-sm"
                >
                  {s?.name ?? id}
                  <button
                    type="button"
                    onClick={() => setSelectedSkillIds((prev) => prev.filter((x) => x !== id))}
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    aria-label="移除"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v && !selectedSkillIds.includes(v)) {
                setSelectedSkillIds((prev) => [...prev, v]);
              }
              e.target.value = "";
            }}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
          >
            <option value="">选择要添加的技能...</option>
            {availableSkills
              .filter((s) => !selectedSkillIds.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.type === "custom" ? "(自定义)" : ""}
                </option>
              ))}
          </select>
          {availableSkills.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              <Link href="/skills" className="text-cyan-600 hover:underline">
                前往技能市场
              </Link>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            大模型
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            论文大纲全文（可编辑、粘贴，将自动解析二级、三级标题）
          </label>
          <textarea
            value={fullOutline}
            onChange={(e) => handleOutlineChange(e.target.value)}
            placeholder="导入或粘贴完整大纲内容，支持 ## 标题、### 子标题、4.1 / 4.1.1 等编号格式"
            rows={12}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 font-mono whitespace-pre-wrap"
          />
          {sections.length > 0 && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              已解析 {sections.length} 个章节（含二级、三级标题）
            </p>
          )}
        </div>
      </div>

      {savedPapers.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
            已保存论文
          </h3>
          <ul className="space-y-2">
            {savedPapers.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2"
              >
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {p.title} · {new Date(p.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadPaper(p.id)}
                    className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    加载
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePaper(p.id)}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            加载后将在论文导出页面打开，可导出 Word / PDF / Markdown
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {sections.length > 0 && (
        <div ref={resultAreaRef} className="space-y-6">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
              选择大纲章节（可精确到节，如 4.1、4.1.1）
            </h3>
            <div className="space-y-1">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSection(s.id)}
                  className={`w-full text-left rounded-lg px-4 py-2 text-sm transition-colors ${
                    selectedSectionId === s.id
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                  style={{ paddingLeft: `${12 + (s.level - 1) * 16}px` }}
                >
                  <span className="font-medium">{s.title}</span>
                  {savedSections[s.id] && (
                    <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">已保存</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedSection && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-2">
                {selectedSection.title}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 whitespace-pre-wrap">
                {selectedSection.fullText}
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={handleGenerateSection}
                  disabled={isGenerating}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                >
                  {isGenerating ? "生成中..." : "生成"}
                </button>
                <div className="flex items-center gap-1">
                  <select
                    value={maxLengthSelect}
                    onChange={(e) => setMaxLengthSelect(e.target.value)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    {PRESET_LENGTHS.map((n) => (
                      <option key={n} value={String(n)}>
                        {n} 字
                      </option>
                    ))}
                    <option value="custom">自定义</option>
                  </select>
                  {maxLengthSelect === "custom" && (
                    <input
                      type="number"
                      min={500}
                      max={20000}
                      value={customMaxLength}
                      onChange={(e) => setCustomMaxLength(Math.min(20000, Math.max(500, Number(e.target.value) || 500)))}
                      placeholder="500-20000"
                      className="w-28 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  )}
                </div>
                {isGenerating && (
                  <button
                    type="button"
                    onClick={() => abortController?.abort()}
                    className="rounded-lg border border-red-300 dark:border-red-700 px-4 py-2 text-sm text-red-600 dark:text-red-400"
                  >
                    中断
                  </button>
                )}
                {generatedContent && !isGenerating && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveSection}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSection}
                      className="rounded-lg border border-red-300 dark:border-red-700 px-4 py-2 text-sm text-red-600 dark:text-red-400"
                    >
                      删除
                    </button>
                  </>
                )}
              </div>
              <textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                placeholder={isGenerating ? "生成中..." : "生成或编辑章节内容"}
                rows={16}
                disabled={isGenerating}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 font-sans whitespace-pre-wrap"
              />
            </div>
          )}

          {Object.keys(savedSections).length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
                已生成内容
              </h3>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleExportFull}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  导出全文
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mergeTitle}
                    onChange={(e) => setMergeTitle(e.target.value)}
                    placeholder="论文标题（可选）"
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm w-48"
                  />
                  <button
                    type="button"
                    onClick={handleMergeSave}
                    disabled={savingMerge}
                    className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {savingMerge ? "保存中..." : "合并保存"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {sections
                  .filter((s) => savedSections[s.id])
                  .map((s, idx) => {
                    const colorClass = SECTION_COLORS[idx % SECTION_COLORS.length];
                    const isExpanded = expandedSections[s.id] !== false;
                    return (
                      <div
                        key={s.id}
                        className={`rounded-lg border ${colorClass} overflow-hidden`}
                      >
                        <div className="flex items-center justify-between px-4 py-2">
                          <button
                            type="button"
                            onClick={() => handleSelectSection(s.id)}
                            className="flex-1 text-left font-medium text-zinc-900 dark:text-zinc-100"
                          >
                            {s.title}
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectSection(s.id)}
                              className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSectionExpand(s.id)}
                              className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
                            >
                              {isExpanded ? "收起" : "展开"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("确定删除该章节内容？")) {
                                  setSavedSections((prev) => {
                                    const next = { ...prev };
                                    delete next[s.id];
                                    return next;
                                  });
                                  if (selectedSectionId === s.id) {
                                    setSelectedSectionId(null);
                                    setGeneratedContent("");
                                  }
                                }
                              }}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-0">
                            <pre className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                              {savedSections[s.id]}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
