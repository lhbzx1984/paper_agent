import Link from "next/link";
import { DataLabChat } from "@/components/data-lab-chat";
import { DataLabPythonRunner } from "@/components/data-lab-python-runner";

export default function DataLabPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          数据实验分析
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          对话式智能体，协助实验设计、统计方法、数据解读与代码实现。可在文献分析页生成「论文实验与验证设计方案」后使用「导入到数据实验分析」，此处将按方案协助模块与代码设计。请在{" "}
          <Link
            href="/settings/llm"
            className="text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            大模型设置
          </Link>{" "}
          中为「数据实验分析」单独配置模型（可与文献分析、工作台使用不同服务商）。可在对话卡片底部切换「对话模型」与「深度思考模型」（如 DeepSeek 对应{" "}
          <code className="text-xs text-zinc-600 dark:text-zinc-400">deepseek-chat</code>{" "}
          /
          <code className="text-xs text-zinc-600 dark:text-zinc-400">deepseek-reasoner</code>
          ）。
        </p>
      </div>
      <DataLabPythonRunner />
      <DataLabChat />
    </div>
  );
}
