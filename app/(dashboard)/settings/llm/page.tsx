"use client";

import { useEffect, useState } from "react";
import type {
  LLMModuleKey,
  LLMModuleConfig,
} from "@/app/api/settings/llm/route";

const MODULE_LABELS: Record<LLMModuleKey, string> = {
  literature_analysis: "文献分析",
  workspace: "研究工作台",
  skills: "技能调用（主题生成、关键词等）",
  data_lab: "数据实验分析（对话智能体）",
};

const DEFAULT_CONFIG: LLMModuleConfig = {
  base_url: "",
  api_key: "",
  model: "",
  model_reasoner: "",
};

export default function LLMSettingsPage() {
  const [settings, setSettings] = useState<
    Record<LLMModuleKey, LLMModuleConfig> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
        else setSettings(null);
      })
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function updateModule(
    key: LLMModuleKey,
    field: keyof LLMModuleConfig,
    value: string
  ) {
    setSettings((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      next[key] = { ...next[key], [field]: value };
      return next;
    });
  }

  function clearModule(key: LLMModuleKey) {
    setSettings((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      next[key] = { ...DEFAULT_CONFIG };
      return next;
    });
    setError(null);
    setSuccess(false);
  }

  function clearAll() {
    setSettings({
      literature_analysis: { ...DEFAULT_CONFIG },
      workspace: { ...DEFAULT_CONFIG },
      skills: { ...DEFAULT_CONFIG },
      data_lab: { ...DEFAULT_CONFIG },
    });
    setError(null);
    setSuccess(false);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
        加载中...
      </div>
    );
  }

  const currentSettings = settings ?? {
    literature_analysis: { ...DEFAULT_CONFIG },
    workspace: { ...DEFAULT_CONFIG },
    skills: { ...DEFAULT_CONFIG },
    data_lab: { ...DEFAULT_CONFIG },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          大模型设置
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          为不同功能模块配置 `base_url`、`api_key` 和 `model`。如果相关字段为空，文献分析/研究工作台/技能调用/数据实验分析将无法正常工作。
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-8"
      >
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            清空全部
          </button>
        </div>

        {(Object.keys(MODULE_LABELS) as LLMModuleKey[]).map((key) => (
          <div
            key={key}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                {MODULE_LABELS[key]}
              </h3>
              <button
                type="button"
                onClick={() => clearModule(key)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                清空
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-1">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  base_url
                </label>
                <input
                  type="url"
                  value={currentSettings[key]?.base_url ?? ""}
                  onChange={(e) =>
                    updateModule(key, "base_url", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  api_key
                </label>
                <input
                  type="password"
                  value={currentSettings[key]?.api_key ?? ""}
                  onChange={(e) =>
                    updateModule(key, "api_key", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  {key === "data_lab"
                    ? "model（对话模型，如 deepseek-chat）"
                    : "model"}
                </label>
                <input
                  type="text"
                  value={currentSettings[key]?.model ?? ""}
                  onChange={(e) =>
                    updateModule(key, "model", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              {key === "data_lab" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    model（深度思考模型，如 deepseek-reasoner）
                  </label>
                  <input
                    type="text"
                    value={currentSettings.data_lab?.model_reasoner ?? ""}
                    onChange={(e) =>
                      updateModule("data_lab", "model_reasoner", e.target.value)
                    }
                    placeholder="留空且 base_url 为 DeepSeek 时默认 deepseek-reasoner"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    DeepSeek 与 OpenAI 兼容：base_url 可用{" "}
                    <code className="text-zinc-600 dark:text-zinc-300">
                      https://api.deepseek.com
                    </code>{" "}
                    或{" "}
                    <code className="text-zinc-600 dark:text-zinc-300">
                      https://api.deepseek.com/v1
                    </code>
                    。对话模型 / 深度思考模型对应{" "}
                    <code className="text-zinc-600 dark:text-zinc-300">
                      deepseek-chat
                    </code>{" "}
                    与{" "}
                    <code className="text-zinc-600 dark:text-zinc-300">
                      deepseek-reasoner
                    </code>
                    （V3.2，128K 上下文）。
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/50 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 px-4 py-2 text-sm text-green-600 dark:text-green-400">
            保存成功
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存设置"}
        </button>
      </form>
    </div>
  );
}
