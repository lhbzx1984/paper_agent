import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateText } from "@/lib/llm/openai";
import type { LLMModuleConfig } from "@/app/api/settings/llm/route";

export const runtime = "nodejs";
export const maxDuration = 120;

const MARKDOWN_INSTRUCTION =
  "请使用 Markdown 格式输出，包括标题（##）、有序/无序列表（- 或 1.）、加粗（**）等，使结构清晰易读。";

/** 根据选中的论文题目生成论文大纲 */
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
      selectedTitle,
      innovations,
      researchDirections,
      paperStructure,
      experimentAndVerification,
      improvementsOrShortcomings,
      improvementSuggestions,
      model,
    } = body as {
      selectedTitle?: string;
      innovations?: string;
      researchDirections?: string;
      paperStructure?: string;
      experimentAndVerification?: string;
      improvementsOrShortcomings?: string;
      improvementSuggestions?: string;
      model?: string;
    };

    if (!selectedTitle?.trim()) {
      return NextResponse.json(
        { error: "请先选择论文题目" },
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

    const contextParts: string[] = [`【论文题目】\n${selectedTitle.trim()}`];
    if (innovations?.trim()) contextParts.push(`【创新点】\n${innovations}`);
    if (researchDirections?.trim()) contextParts.push(`【研究方向】\n${researchDirections}`);
    if (paperStructure?.trim()) contextParts.push(`【论文结构】\n${paperStructure}`);
    if (experimentAndVerification?.trim())
      contextParts.push(
        `【文献内实验与验证梳理】（来自文献分析）\n${experimentAndVerification}`,
      );
    if (improvementsOrShortcomings?.trim()) contextParts.push(`【改进方向与不足】\n${improvementsOrShortcomings}`);
    if (improvementSuggestions?.trim()) contextParts.push(`【改进意见与创新点】\n${improvementSuggestions}`);

    const system =
      "你是论文结构设计专家。根据选定的论文题目及文献分析结果，给出完整论文大纲，包括各章节标题、子节与写作要点，层次清晰。" +
      MARKDOWN_INSTRUCTION;
    const prompt = `【分析内容】\n${contextParts.join("\n\n---\n\n")}\n\n请基于以上论文题目与分析内容，生成完整论文大纲。「文献内实验与验证梳理」仅反映参考文献中的实验描述；本篇论文的独立实验方案可在生成大纲后另行生成。`;

    const outline = await generateText({
      system,
      prompt,
      model: model || llmConfig?.model,
      apiKey: llmConfig?.api_key,
      baseURL: (llmConfig as { base_url?: string })?.base_url,
    });

    return NextResponse.json({ outline: outline?.trim() ?? "" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "生成失败" },
      { status: 500 }
    );
  }
}
