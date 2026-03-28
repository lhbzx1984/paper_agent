import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export type DataLabModelMode = "chat" | "reasoner";

/**
 * 解析数据实验分析实际请求的 model：非思考用 model，思考用 model_reasoner（可空则按 DeepSeek 默认）。
 */
export function resolveDataLabModel(
  mod: LLMModuleConfig | null | undefined,
  mode: DataLabModelMode,
): string {
  if (!mod) return "";
  const base = (mod.base_url ?? "").toLowerCase();
  const isDeepseek =
    base.includes("deepseek") || base.includes("api.deepseek.com");

  if (mode === "reasoner") {
    const r = mod.model_reasoner?.trim();
    if (r) return r;
    if (isDeepseek) return "deepseek-reasoner";
    return mod.model?.trim() || "";
  }

  const m = mod.model?.trim();
  if (m) return m;
  if (isDeepseek) return "deepseek-chat";
  return "";
}
