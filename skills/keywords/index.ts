import { generateText, generateTextStream } from "../../lib/llm/openai";

export interface KeywordSkillInput {
  topic: string;
  context?: string;
}

export interface KeywordSkillOutput {
  keywords: string[];
}

export async function executeKeywordSkill(
  input: KeywordSkillInput,
): Promise<KeywordSkillOutput> {
  const system =
    "你是科研关键词助手，请从主题与上下文中提取 10-20 个高质量关键词与扩展词，使用逗号分隔输出。";
  const prompt = `主题: ${input.topic}\n上下文: ${
    input.context ?? "无"
  }\n请输出适合文献检索和向量检索的关键词与扩展短语，中文为主，可适当加入英文术语。`;
  const text = await generateText({ system, prompt });
  return parseKeywords(text);
}

/** 流式版本，更快返回首字节，避免 xchai 等 API 的 60 秒超时 */
export async function executeKeywordSkillStream(
  input: KeywordSkillInput,
): Promise<KeywordSkillOutput> {
  const system =
    "你是科研关键词助手，请从主题与上下文中提取 10-20 个高质量关键词与扩展词，使用逗号分隔输出。";
  const prompt = `主题: ${input.topic}\n上下文: ${
    input.context ?? "无"
  }\n请输出适合文献检索和向量检索的关键词与扩展短语，中文为主，可适当加入英文术语。`;
  let text = "";
  for await (const chunk of generateTextStream({ system, prompt })) {
    text += chunk;
  }
  return parseKeywords(text);
}

function parseKeywords(text: string | null | undefined): KeywordSkillOutput {
  const keywords = (text ?? "")
    .split(/[,，\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return { keywords };
}

