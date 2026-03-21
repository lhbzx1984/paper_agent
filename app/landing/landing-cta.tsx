import Link from "next/link";

const WORKFLOW_STEPS = [
  { label: "文献检索", desc: "全球学术资源" },
  { label: "文献分析", desc: "AI 深度分析" },
  { label: "研究工作台", desc: "逐章节写作" },
  { label: "论文生成", desc: "终稿导出" },
];

export function LandingCta() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/[0.08] via-transparent to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-cyan-500/[0.04] blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-6">
        {/* Workflow pipeline */}
        <div className="mb-20">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-600 mb-10">
            完整的学术研究工作流
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center text-center w-36">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-2">
                    <span className="text-lg font-bold text-cyan-400 font-[family-name:var(--font-space-grotesk)]">
                      {i + 1}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {step.label}
                  </span>
                  <span className="text-xs text-zinc-500 mt-0.5">
                    {step.desc}
                  </span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden sm:block w-12 h-px bg-gradient-to-r from-cyan-500/40 to-cyan-500/10 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA content */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl font-[family-name:var(--font-space-grotesk)]">
            <span className="text-white">SRA 重构你的</span>
            <br className="sm:hidden" />
            <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
              学术工作流
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400">
            从文献搜索、深度分析到论文写作，AI Agent 为你扫清所有障碍。
            <br className="hidden sm:block" />
            下一个突破，无需再漫长等待。
          </p>

          <div className="mt-10">
            <Link
              href="/register"
              className="inline-block rounded-xl bg-cyan-500 px-10 py-4 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 hover:bg-cyan-400 transition-all hover:shadow-cyan-500/40"
            >
              开始使用
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-zinc-500">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              免费注册
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              项目隔离
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              可复现流程
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              数据安全
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
