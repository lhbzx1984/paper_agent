import {
  Search,
  BookOpen,
  PenTool,
  Database,
  Puzzle,
  Cpu,
  Layers,
  Brain,
  Workflow,
} from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Workflow,
    title: "一站式学术工作流",
    desc: "从文献检索、知识管理、AI 分析到论文写作，所有研究环节无缝衔接。打破工具割裂，让学术研究在一个平台内流畅完成。",
  },
  {
    icon: Brain,
    title: "智能知识管理",
    desc: "基于向量数据库的语义搜索，智能关联你的文献与研究数据。自动构建知识体系，发现隐藏的研究关联。",
  },
  {
    icon: Puzzle,
    title: "插件化技能系统",
    desc: "每个研究能力独立封装为 Skill，按需组合调用。支持自定义技能扩展，灵活适应不同研究场景。",
  },
];

const FEATURES = [
  {
    icon: Search,
    title: "文献检索",
    desc: "基于 OpenAlex 的全球学术文献实时检索，支持多字段搜索、引用排序与高级筛选，一键获取海量研究资源。",
  },
  {
    icon: BookOpen,
    title: "文献分析",
    desc: "AI 驱动的深度文献分析，自动提取创新点、研究方向、论文结构、实验设计与改进建议。",
  },
  {
    icon: PenTool,
    title: "智能写作",
    desc: "按大纲章节逐步生成论文内容，支持流式输出、中断续写、内容编辑与格式导出。",
  },
  {
    icon: Database,
    title: "知识管理",
    desc: "基于 pgvector 的语义检索，上传 PDF/文档自动向量化，智能管理文献、笔记与研究数据。",
  },
  {
    icon: Layers,
    title: "技能市场",
    desc: "丰富的内置技能与自定义技能支持，从主题生成到引用标准化，灵活扩展研究能力。",
  },
  {
    icon: Cpu,
    title: "多模型集成",
    desc: "支持 DeepSeek 等多种大语言模型，可自由配置 API，按需切换最优 AI 引擎。",
  },
];

export function LandingFeatures() {
  return (
    <>
      {/* Section 1: Redefine */}
      <section id="features" className="relative py-24 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl font-[family-name:var(--font-space-grotesk)]">
              <span className="text-white">重新定义</span>
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                学术研究体验
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-zinc-400">
              在这个信息爆炸的时代，学术研究需要的不仅是工具，更是智慧的整合。
              <br className="hidden md:block" />
              SRA 将文献检索、文献分析、智能写作等研究功能无缝集成于一个平台，
              让知识的探索与创造前所未有的高效流畅。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.title}
                className="landing-card group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5"
              >
                <div className="mb-5 inline-flex rounded-xl bg-cyan-500/10 p-3.5">
                  <h.icon className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  {h.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {h.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Focus quote */}
      <section className="relative py-20 md:py-28">
        <div className="landing-divider mx-auto max-w-4xl mb-20" />
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl font-[family-name:var(--font-space-grotesk)] leading-snug">
            <span className="text-white">你可以切换软件，打断思路</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              但你不必如此
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400">
            SRA 将文献检索、文献分析、智能写作、知识管理无缝集成于一个平台。
            <br className="hidden sm:block" />
            从灵感到终稿，享受行云流水般的沉浸式工作体验，保护你最宝贵的专注力。
          </p>
        </div>
        <div className="landing-divider mx-auto max-w-4xl mt-20" />
      </section>

      {/* Section 3: Feature grid */}
      <section className="relative py-24 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl font-[family-name:var(--font-space-grotesk)]">
              <span className="text-white">一切你需要的</span>
              <br className="sm:hidden" />
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                {" "}都在这里
              </span>
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="landing-card group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5"
              >
                <div className="mb-4 inline-flex rounded-xl bg-white/5 p-3">
                  <f.icon className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Architecture bar */}
          <div className="mt-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-wrap justify-center gap-3">
                {["LangGraph", "Skill", "pgvector", "向量库", "Supabase"].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      <span className="text-sm font-medium text-cyan-300">
                        {item}
                      </span>
                    </div>
                  ),
                )}
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs uppercase tracking-widest text-zinc-600">
                  技术架构
                </p>
                <p className="mt-1 text-base font-medium text-white">
                  大脑 + 技能 + 记忆 + 数据
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
