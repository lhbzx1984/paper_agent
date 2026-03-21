"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  FileDown,
  Home,
  Layers,
  PenLine,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";

const STORAGE_PREFIX = "sra_dashboard_onboarding_v1";

type Step = {
  id: string;
  title: string;
  description: string;
  tips: string[];
  href?: string;
  linkLabel?: string;
  icon: ComponentType<{ className?: string }>;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "欢迎使用 Scientific Research Agent",
    description:
      "SRA 是插件化科研智能体：大脑（LangGraph）+ 技能（Skill）+ 记忆（向量库）+ 数据。下面将带您快速了解各功能入口。",
    tips: [
      "左侧导航可随时切换模块",
      "建议按「项目 → 文献 → 分析 → 写作」顺序使用",
    ],
    icon: Sparkles,
  },
  {
    id: "overview",
    title: "概览",
    description: "当前页面为工作台概览，可从这里进入各功能模块。",
    tips: ["创建项目后，再上传文献与分析，流程更顺畅"],
    href: "/dashboard",
    linkLabel: "概览",
    icon: Home,
  },
  {
    id: "projects",
    title: "项目管理",
    description: "为每个研究课题创建独立项目，每个项目对应一个知识库空间，便于隔离文献与向量数据。",
    tips: ["先创建项目，再在「知识库」中向该项目上传文档"],
    href: "/projects",
    linkLabel: "前往项目管理",
    icon: Layers,
  },
  {
    id: "upload",
    title: "知识库（文献上传）",
    description: "上传 PDF、Word、TXT 等文档，系统会分块并向量化，供文献分析与 RAG 检索使用。",
    tips: ["上传后需等待处理完成再进行分析", "同一项目下的文档会一起参与检索"],
    href: "/upload",
    linkLabel: "前往知识库",
    icon: Database,
  },
  {
    id: "analyze",
    title: "文献分析",
    description: "基于知识库内容做创新点、研究方向、论文结构等分析；支持单篇、多篇或全库范围。",
    tips: ["请先在「大模型设置」中配置文献分析所用模型", "分析结果可保存，供研究工作台引用大纲"],
    href: "/analyze",
    linkLabel: "前往文献分析",
    icon: BookOpen,
  },
  {
    id: "skills",
    title: "技能市场",
    description: "启用或管理研究相关技能（如主题生成、关键词等），在工作台与智能体流程中按需调用。",
    tips: ["可浏览内置技能与自定义技能", "技能与项目、文献配合使用效果更佳"],
    href: "/skills",
    linkLabel: "前往技能市场",
    icon: Search,
  },
  {
    id: "workspace",
    title: "研究工作台",
    description: "导入大纲、关联技能，按章节流式生成论文内容；可保存、合并导出。",
    tips: ["可从文献分析导入已保存的大纲", "生成前请在「大模型设置」中配置工作台模型"],
    href: "/workspace",
    linkLabel: "前往研究工作台",
    icon: PenLine,
  },
  {
    id: "paper",
    title: "论文检索与导出",
    description: "检索学术文献，并将完成的论文内容导出为 Word、PDF、LaTeX 等格式。",
    tips: ["论文导出与检索入口在侧栏「论文导出」"],
    href: "/paper",
    linkLabel: "前往论文导出",
    icon: FileDown,
  },
  {
    id: "llm",
    title: "大模型设置",
    description: "为「文献分析」「研究工作台」「技能调用」分别配置 API（base_url、api_key、model）。未配置时相关功能将无法调用模型。",
    tips: ["各模块可配置不同服务商与模型", "配置保存后立即在对应页面生效"],
    href: "/settings/llm",
    linkLabel: "前往大模型设置",
    icon: Settings2,
  },
];

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}_${userId}`;
}

export function DashboardOnboarding({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const readDone = useCallback(() => {
    if (typeof window === "undefined" || !userId) return true;
    try {
      return window.localStorage.getItem(storageKey(userId)) === "1";
    } catch {
      return true;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setOpen(!readDone());
    setStepIndex(0);
  }, [userId, readDone]);

  const markDone = useCallback(() => {
    if (!userId) return;
    try {
      window.localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [userId]);

  const handleOpenGuide = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  const step = STEPS[stepIndex];
  const Icon = step?.icon ?? Sparkles;
  const isLast = stepIndex >= STEPS.length - 1;

  return (
    <>
      {open && step && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
        >
          <div
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
            aria-hidden
            onClick={() => {
              /* 点击遮罩不关闭，避免误触；用户需点跳过或完成 */
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    使用引导 {stepIndex + 1} / {STEPS.length}
                  </p>
                  <h2
                    id="onboarding-title"
                    className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    {step.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={markDone}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="关闭并标记已学习"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {step.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                {step.tips.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-cyan-500">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              {step.href && step.linkLabel && (
                <Link
                  href={step.href}
                  className="mt-4 inline-flex text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                  onClick={markDone}
                >
                  {step.linkLabel} →
                </Link>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={markDone}
                className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                跳过引导
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一步
                </button>
                {isLast ? (
                  <button
                    type="button"
                    onClick={markDone}
                    className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 dark:bg-cyan-500"
                  >
                    完成学习
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    下一步
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-1.5 pb-4">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStepIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIndex
                      ? "w-6 bg-cyan-500"
                      : "w-1.5 bg-zinc-300 dark:bg-zinc-600"
                  }`}
                  aria-label={`第 ${i + 1} 步`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {userId && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleOpenGuide}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-800 hover:bg-cyan-100 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-950/70"
            >
              <Sparkles className="h-4 w-4" />
              查看使用引导
            </button>
            <span className="text-xs text-zinc-500">
              可随时重新打开分步说明
            </span>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
