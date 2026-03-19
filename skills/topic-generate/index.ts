import { generateText, generateTextStream } from "../../lib/llm/openai";

export interface TopicGenerateInput {
  domain?: string;
  interests?: string;
}

export interface TopicGenerateOutput {
  topics: string[];
}

export async function executeTopicGenerate(
  input: TopicGenerateInput,
): Promise<TopicGenerateOutput> {
  const system =
    "你是科研选题助手，请根据给定领域与兴趣生成 5-8 个高质量研究主题，使用中文输出，每行一个主题。";

  const prompt = `领域: ${input.domain ?? "未指定"}\n兴趣方向: ${
    input.interests ?? "未指定"
  }\n请给出具体可行的研究课题标题。`;

  const text = await generateText({ system, prompt });
  return parseTopics(text);
}

/** 流式版本，更快返回首字节，避免 xchai 等 API 的 60 秒超时 */
export async function executeTopicGenerateStream(
  input: TopicGenerateInput,
): Promise<TopicGenerateOutput> {
  const system =
    "你是科研选题助手，请根据给定领域与兴趣生成 5-8 个高质量研究主题，使用中文输出，每行一个主题。";
  const prompt = `领域: ${input.domain ?? "未指定"}\n兴趣方向: ${
    input.interests ?? "未指定"
  }\n请给出具体可行的研究课题标题。`;
  let text = "";
  for await (const chunk of generateTextStream({ system, prompt })) {
    text += chunk;
  }
  return parseTopics(text);
}

function parseTopics(text: string | null | undefined): TopicGenerateOutput {
  const topics = (text ?? "")
    .split("\n")
    .map((t) => t.replace(/^[\d\-\.●、\s]+/, "").trim())
    .filter(Boolean);
  return { topics };
}

