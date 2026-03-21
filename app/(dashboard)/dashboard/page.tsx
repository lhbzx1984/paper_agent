import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { DashboardOnboarding } from "@/components/dashboard-onboarding";

export default async function DashboardPage() {
  let userId = "";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? "";
  } catch {
    userId = "";
  }

  return (
    <DashboardOnboarding userId={userId}>
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            欢迎使用 Scientific Research Agent
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            插件化智能体 = 大脑（LangGraph） + 技能（Skill） + 记忆（向量库） + 数据
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/projects"
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              项目管理
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              创建和管理研究项目，每个项目对应一个知识库
            </p>
          </Link>
          <Link
            href="/upload"
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              知识库
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              文档管理：上传、下载 PDF / Word / TXT，构建 RAG
            </p>
          </Link>
          <Link
            href="/skills"
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              技能市场
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              启用研究主题、关键词、创新点等 10 大技能
            </p>
          </Link>
          <Link
            href="/workspace"
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              研究工作台
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              端到端自动科研流程，从主题到论文
            </p>
          </Link>
          <Link
            href="/paper"
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              论文导出
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              导出 Word / PDF / LaTeX 格式
            </p>
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
            快速开始
          </h3>
          <ol className="mt-4 list-decimal list-inside space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>在项目管理中创建项目</li>
            <li>在知识库中上传相关文献（PDF/Word）</li>
            <li>在工作台输入研究需求，启动智能体</li>
            <li>生成论文并导出</li>
          </ol>
        </div>
      </div>
    </DashboardOnboarding>
  );
}
