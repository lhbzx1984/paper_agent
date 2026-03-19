"use client";

import { useEffect, useState } from "react";

interface Skill {
  id: string;
  name: string;
  description?: string | null;
  type?: "builtin" | "custom";
  system_prompt?: string;
  prompt_template?: string;
}

const IMPORT_TEMPLATE = [
  {
    name: "示例技能",
    description: "示例描述",
    system_prompt: "你是一个科研助手。",
    prompt_template: "用户输入：\n{{input}}",
  },
];

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showGenerate, setShowGenerate] = useState(false);
  const [genName, setGenName] = useState("");
  const [genDesc, setGenDesc] = useState("");
  const [genPrompt, setGenPrompt] = useState("");
  const [genTemplate, setGenTemplate] = useState("用户输入：\n{{input}}");
  const [submitting, setSubmitting] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState(JSON.stringify(IMPORT_TEMPLATE, null, 2));
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  async function fetchSkills() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      setSkills(data.skills ?? []);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genName.trim() || !genPrompt.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: genName.trim(),
          description: genDesc.trim() || undefined,
          system_prompt: genPrompt.trim(),
          prompt_template: genTemplate.trim() || "用户输入：\n{{input}}",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      setSkills((prev) => [{ ...data.skill, type: "custom" }, ...prev]);
      setGenName("");
      setGenDesc("");
      setGenPrompt("");
      setGenTemplate("用户输入：\n{{input}}");
      setShowGenerate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImport() {
    try {
      const parsed = JSON.parse(importJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      setImporting(true);
      setError(null);
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");
      await fetchSkills();
      setShowImport(false);
      setImportJson(JSON.stringify(IMPORT_TEMPLATE, null, 2));
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "JSON 格式错误"
          : e instanceof Error
            ? e.message
            : "导入失败"
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    try {
      const res = await fetch("/api/skills/export?type=all");
      if (!res.ok) throw new Error("导出失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skills_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该技能？")) return;
    try {
      const res = await fetch(`/api/skills/custom/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            技能市场
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            内置技能 + 自定义技能，支持生成、导入、导出
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGenerate(true)}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            生成技能
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            导入
          </button>
          <button
            onClick={handleExport}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            导出
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {showGenerate && (
        <form
          onSubmit={handleGenerate}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4"
        >
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
            生成新技能
          </h3>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              名称
            </label>
            <input
              value={genName}
              onChange={(e) => setGenName(e.target.value)}
              placeholder="例如：创新点分析"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              描述（可选）
            </label>
            <input
              value={genDesc}
              onChange={(e) => setGenDesc(e.target.value)}
              placeholder="简要说明技能用途"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              系统提示词
            </label>
            <textarea
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              placeholder="定义 AI 的角色与行为，例如：你是科研助手，负责..."
              rows={4}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              输入模板（用 &#123;&#123;input&#125;&#125; 表示用户输入）
            </label>
            <textarea
              value={genTemplate}
              onChange={(e) => setGenTemplate(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
            >
              {submitting ? "创建中..." : "创建"}
            </button>
            <button
              type="button"
              onClick={() => setShowGenerate(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {showImport && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
            导入技能
          </h3>
          <p className="text-sm text-zinc-500">
            粘贴 JSON 格式的技能定义，支持单个或数组。格式：&#123; name, description?, system_prompt, prompt_template? &#125;
          </p>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 font-mono text-sm"
          />
          <div className="flex gap-2">
            <input
              type="file"
              accept=".json"
              className="hidden"
              id="import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const r = new FileReader();
                  r.onload = () => setImportJson(String(r.result ?? ""));
                  r.readAsText(f);
                }
              }}
            />
            <label
              htmlFor="import-file"
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium cursor-pointer"
            >
              选择文件
            </label>
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
            >
              {importing ? "导入中..." : "导入"}
            </button>
            <button
              onClick={() => setShowImport(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
          加载中...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {s.name}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {s.type === "custom" ? "自定义" : "内置"}
                  </span>
                </div>
                {s.type === "custom" && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    删除
                  </button>
                )}
              </div>
              {s.description && (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {s.description}
                </p>
              )}
              {s.type === "custom" && s.system_prompt && (
                <p className="mt-2 text-xs text-zinc-400 line-clamp-2">
                  {s.system_prompt}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
