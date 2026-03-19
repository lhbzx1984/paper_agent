import {
  Lightbulb,
  Search,
  FlaskConical,
  FileCode,
  BookOpen,
  Download,
} from "lucide-react";

const features = [
  {
    icon: Lightbulb,
    title: "研究主题生成",
    desc: "基于领域与兴趣，智能生成研究方向与选题",
    color: "from-cyan-500/20 to-cyan-600/5",
  },
  {
    icon: Search,
    title: "关键词挖掘",
    desc: "提取与扩展关键词，结合 RAG 检索文献",
    color: "from-emerald-500/20 to-emerald-600/5",
  },
  {
    icon: FlaskConical,
    title: "实验方案设计",
    desc: "自动设计实验流程与变量控制方案",
    color: "from-violet-500/20 to-violet-600/5",
  },
  {
    icon: FileCode,
    title: "代码实验",
    desc: "生成 Python/Matlab 实验代码，可复现研究",
    color: "from-amber-500/20 to-amber-600/5",
  },
  {
    icon: BookOpen,
    title: "论文写作",
    desc: "大纲生成、逐章写作、格式排版、引用标准化",
    color: "from-rose-500/20 to-rose-600/5",
  },
  {
    icon: Download,
    title: "多格式导出",
    desc: "支持 Word、PDF、LaTeX 终稿导出",
    color: "from-sky-500/20 to-sky-600/5",
  },
];

export function LandingFeatures() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/3 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl font-[family-name:var(--font-space-grotesk)]">
            <span className="text-white">10 大科研技能</span>
            <span className="text-cyan-400"> 插件化调用</span>
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-zinc-400">
            每个研究能力独立封装为 Skill，按需组合，端到端自动化
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`group relative rounded-2xl border border-white/5 bg-gradient-to-br ${feature.color} p-6 backdrop-blur-sm transition-all hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5`}
            >
              <div className="mb-4 inline-flex rounded-xl bg-white/5 p-3">
                <feature.icon className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Architecture diagram placeholder - flat style */}
        <div className="mt-20 rounded-2xl border border-white/5 bg-white/[0.02] p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-wrap justify-center gap-4">
              {["LangGraph", "Skill", "pgvector", "向量库"].map((item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2"
                >
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="text-sm font-medium text-cyan-300">{item}</span>
                </div>
              ))}
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-zinc-500">技术架构</p>
              <p className="mt-1 text-lg font-medium text-white">
                大脑 + 技能 + 记忆 + 数据
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
