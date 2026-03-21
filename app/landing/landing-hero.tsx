import Link from "next/link";

const TECH = [
  "LangGraph",
  "RAG",
  "pgvector",
  "Supabase",
  "Next.js",
  "OpenAlex",
  "DeepSeek",
  "向量检索",
  "SSE 流式",
  "LangChain",
];

const STATS = [
  { value: "10+", label: "科研技能插件" },
  { value: "10x", label: "效率提升" },
  { value: "端到端", label: "从主题到论文" },
  { value: "\u221E", label: "知识永久留存" },
];

export function LandingHero() {
  return (
    <section className="relative pt-32 pb-12 md:pt-44 md:pb-16">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-5 py-2 text-sm text-cyan-400/90">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            SRA v1.0 &middot; AI 驱动的科研智能体平台
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center text-4xl font-bold tracking-tight leading-[1.15] sm:text-5xl md:text-6xl lg:text-7xl font-[family-name:var(--font-space-grotesk)]">
          <span className="bg-gradient-to-r from-white via-zinc-100 to-zinc-300 bg-clip-text text-transparent">
            释放你的科研潜能
          </span>
          <br />
          <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
            AI 驱动，10 倍加速
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed text-zinc-400">
          使用 SRA 重构科研范式，从文献综述到数据分析，再到论文成稿，
          <br className="hidden sm:block" />
          AI Agent 为您处理 80% 的重复工作，让您专注于最核心的创新与思考。
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-cyan-500 px-8 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 hover:bg-cyan-400 transition-all hover:shadow-cyan-500/40"
          >
            快速开始
          </Link>
          <Link
            href="#features"
            className="rounded-xl border border-zinc-600 px-8 py-3.5 text-base font-medium text-zinc-300 hover:border-zinc-500 hover:bg-white/5 transition-colors"
          >
            了解更多
          </Link>
        </div>

        {/* Tech stack marquee */}
        <div className="mt-24">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-600 mb-6">
            采用行业标准工具和最佳实践构建
          </p>
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#0a0f1a] to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#0a0f1a] to-transparent z-10" />
            <div className="flex gap-16 animate-marquee whitespace-nowrap">
              {[...TECH, ...TECH].map((item, i) => (
                <span
                  key={i}
                  className="text-base font-medium text-zinc-500/60 select-none"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
                {s.value}
              </div>
              <p className="mt-2 text-sm text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
