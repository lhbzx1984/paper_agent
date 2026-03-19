import Link from "next/link";
import { ResearchGraph } from "./research-graph";

export function LandingHero() {
  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-cyan-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            LangGraph · RAG · 向量库
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl font-[family-name:var(--font-space-grotesk)]">
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              从研究主题
            </span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
              到完整论文
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-zinc-400">
            插件化科研智能体，整合 10 大技能：主题生成、关键词挖掘、创新点分析、
            实验设计、代码生成、论文大纲、章节写作、格式排版、引用标准化、终稿导出
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-cyan-500 px-8 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 hover:bg-cyan-400 transition-all hover:shadow-cyan-500/40"
            >
              立即开始
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-zinc-600 px-8 py-3.5 text-base font-medium text-zinc-300 hover:border-zinc-500 hover:bg-white/5 transition-colors"
            >
              已有账户登录
            </Link>
          </div>
        </div>

        {/* Research graph illustration */}
        <div className="mt-20 flex justify-center">
          <ResearchGraph />
        </div>
      </div>
    </section>
  );
}
