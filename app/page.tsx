import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LandingHero } from "./landing/landing-hero";
import { LandingFeatures } from "./landing/landing-features";
import { LandingCta } from "./landing/landing-cta";

export default async function HomePage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  } catch {
    // If Supabase is unavailable (e.g. missing env vars on preview deploy),
    // fall through and render the landing page for unauthenticated visitors.
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white overflow-hidden">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(34,211,238,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.015)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0f1a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-xl font-semibold tracking-tight font-[family-name:var(--font-space-grotesk)]">
              SRA
            </span>
            <span className="hidden sm:inline text-xs text-cyan-400/80 font-medium border border-cyan-500/20 rounded-full px-2.5 py-0.5">
              v1.0
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="#features"
              className="hidden sm:inline-block text-sm text-zinc-400 hover:text-white transition-colors px-3 py-2"
            >
              功能
            </Link>
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-2"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              快速开始
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingCta />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold font-[family-name:var(--font-space-grotesk)]">
                SRA
              </span>
              <span className="text-xs text-zinc-600">
                Scientific Research Agent
              </span>
            </div>
            <p className="text-sm text-zinc-600">
              插件化智能体 = 大脑（LangGraph） + 技能（Skill） + 记忆（向量库） + 数据
            </p>
          </div>
          <div className="mt-6 text-center text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} SRA &middot; 保留所有权利
          </div>
        </div>
      </footer>
    </div>
  );
}
