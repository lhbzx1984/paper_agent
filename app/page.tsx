import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LandingHero } from "./landing/landing-hero";
import { LandingFeatures } from "./landing/landing-features";
import { LandingCta } from "./landing/landing-cta";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white overflow-hidden">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(34,211,238,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0f1a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight">SRA</span>
            <span className="text-xs text-cyan-400/80 font-medium">科研智能体</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              免费注册
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingCta />
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-zinc-500">
          Scientific Research Agent · 插件化智能体 · 大脑 + 技能 + 记忆 + 数据
        </div>
      </footer>
    </div>
  );
}
