"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "概览" },
  { href: "/projects", label: "项目管理" },
  { href: "/upload", label: "知识库" },
  { href: "/analyze", label: "文献分析" },
  { href: "/skills", label: "技能市场" },
  { href: "/workspace", label: "研究工作台" },
  { href: "/paper", label: "论文导出" },
  { href: "/settings/llm", label: "大模型设置" },
];

export function DashboardNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex flex-col p-4">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <button
          onClick={handleLogout}
          className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
        >
          退出登录
        </button>
      </div>
    </nav>
  );
}
