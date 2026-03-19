"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchProjects() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "加载失败");
      }
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      setProjects((prev) => [data.project, ...prev]);
      setName("");
      setDescription("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新失败");
      setProjects((prev) =>
        prev.map((p) => (p.id === editingId ? data.project : p))
      );
      setEditingId(null);
      setName("");
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该项目？其下的文档与知识库内容将一并删除。")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "删除失败");
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }

  function startEdit(p: Project) {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setDescription("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            项目管理
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            创建与管理研究项目，每个项目对应一个知识库
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            cancelEdit();
            setShowForm((v) => !v);
          }}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          {showForm ? "取消" : "新建项目"}
        </button>
      </div>

      {(showForm || editingId) && (
        <form
          onSubmit={editingId ? handleUpdate : handleCreate}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4"
        >
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
            {editingId ? "编辑项目" : "新建项目"}
          </h3>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              项目名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：深度学习图像识别、医学影像分割"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              描述（可选）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述项目研究方向与目标"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {submitting
                ? editingId
                  ? "保存中..."
                  : "创建中..."
                : editingId
                  ? "保存"
                  : "创建"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                cancelEdit();
              }}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
          加载中...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">暂无项目</p>
          <p className="mt-2 text-sm text-zinc-400">
            点击「新建项目」创建第一个项目，创建后可前往知识库上传文档
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="relative">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {p.name}
                  </h3>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
                {p.description && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {p.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-zinc-400">
                  {new Date(p.created_at).toLocaleDateString("zh-CN")}
                </p>
                <Link
                  href={`/upload?projectId=${p.id}`}
                  className="mt-2 inline-block text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  进入知识库（文档管理）→
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
