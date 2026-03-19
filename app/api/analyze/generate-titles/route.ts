import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateText } from "@/lib/llm/openai";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 根据改进意见与创新点生成 1-5 个论文题目 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      improvementSuggestions,
      innovations,
      researchDirections,
      model,
    } = body as {
      improvementSuggestions?: string;
      innovations?: string;
      researchDirections?: string;
      model?: string;
    };

    if (!improvementSuggestions?.trim()) {
      return NextResponse.json(
        { error: "improvementSuggestions 不能为空，请先完成分析或填写改进意见与创新点" },
        { status: 400 }
      );
    }

    let llmConfig: LLMModuleConfig | undefined;
    const { data: settingsRow } = await supabase
      .from("user_llm_settings")
      .select("settings")
      .eq("user_id", user.id)
      .single();
    const raw = (settingsRow?.settings as Record<string, LLMModuleConfig>) ?? {};
    const mod = raw.literature_analysis;
    if (mod && (mod.api_key || mod.base_url || mod.model)) {
      llmConfig = mod as LLMModuleConfig;
    }

    const context = [improvementSuggestions];
    if (innovations?.trim()) context.push(`【创新点】\n${innovations}`);
    if (researchDirections?.trim()) context.push(`【研究方向】\n${researchDirections}`);

    const system =
      "你是科研选题专家。根据改进意见与创新点、创新点、研究方向等分析内容，生成 1-5 个可作为后续研究论文的题目建议。\n\n" +
      "请严格按照以下格式输出，每行一个题目，格式为：1. 题目一\n2. 题目二\n...";
    const prompt = `【分析内容】\n${context.join("\n\n---\n\n")}\n\n请生成 1-5 个论文题目，每行一个，格式为：1. 题目\n2. 题目\n...`;

    const text = await generateText({
      system,
      prompt,
      model: model || llmConfig?.model,
      apiKey: llmConfig?.api_key,
      baseURL: (llmConfig as { base_url?: string })?.base_url,
    });

    const titles: string[] = [];
    const lines = (text || "").split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const m = line.match(/^\d+[\.\、]\s*(.+)$/);
      if (m) titles.push(m[1].trim());
      else if (line.trim()) titles.push(line.trim());
      if (titles.length >= 5) break;
    }

    return NextResponse.json({
      titles: titles.length ? titles : [text?.trim() || "未生成题目"].filter(Boolean),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "生成失败" },
      { status: 500 }
    );
  }
}
