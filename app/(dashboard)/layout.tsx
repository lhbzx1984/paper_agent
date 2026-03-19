import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardNav } from "./dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex h-16 items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            SRA
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            科研智能体
          </span>
        </div>
        <DashboardNav userEmail={user.email ?? ""} />
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-8">
          <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            工作台
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {user.email}
            </span>
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
