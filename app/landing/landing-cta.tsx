import Link from "next/link";
import { PaperOutline } from "./paper-outline";

export function LandingCta() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 via-transparent to-transparent" />

      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="absolute left-[10%] top-[20%]">
          <PaperOutline />
        </div>
        <div className="absolute right-[15%] bottom-[25%] rotate-12">
          <PaperOutline />
        </div>
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl font-[family-name:var(--font-space-grotesk)]">
          <span className="text-white">开启</span>
          <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
            {" "}智能科研{" "}
          </span>
          <span className="text-white">之旅</span>
        </h2>
        <p className="mt-6 text-lg text-zinc-400">
          上传文献、启用技能、输入需求，从主题到论文一键生成
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-cyan-500 px-10 py-4 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 hover:bg-cyan-400 transition-all hover:shadow-cyan-500/40"
          >
            免费注册
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-zinc-600 px-10 py-4 text-base font-medium text-zinc-300 hover:border-zinc-500 hover:bg-white/5 transition-colors"
          >
            登录账户
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            邮箱注册
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            项目隔离
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            可复现流程
          </span>
        </div>
      </div>
    </section>
  );
}
