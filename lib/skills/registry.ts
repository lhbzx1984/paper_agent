import { executeTopicGenerate, TopicGenerateInput } from "../../skills/topic-generate";
import { executeKeywordSkill, KeywordSkillInput } from "../../skills/keywords";
import { generateText } from "../llm/openai";

type SkillId = "topic-generate" | "keywords";

export type AnySkillInput = TopicGenerateInput | KeywordSkillInput;

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  type?: "builtin" | "custom";
}

const builtinSkills: SkillDefinition[] = [
  {
    id: "topic-generate",
    name: "研究主题生成",
    description: "根据领域与兴趣自动生成研究主题。",
    type: "builtin",
  },
  {
    id: "keywords",
    name: "关键词挖掘",
    description: "为检索与 RAG 提取与扩展关键词。",
    type: "builtin",
  },
];

export function listSkills(): SkillDefinition[] {
  return builtinSkills;
}

export async function executeSkill(
  id: string,
  input: unknown,
  customSkill?: { system_prompt: string; prompt_template: string }
) {
  if (customSkill) {
    const userInput = typeof input === "string" ? input : (input as Record<string, string>)?.input ?? JSON.stringify(input);
    const prompt = customSkill.prompt_template.replace(/\{\{input\}\}/g, userInput);
    const text = await generateText({
      system: customSkill.system_prompt,
      prompt,
    });
    return { output: text };
  }

  switch (id) {
    case "topic-generate":
      return executeTopicGenerate(input as TopicGenerateInput);
    case "keywords":
      return executeKeywordSkill(input as KeywordSkillInput);
    default:
      throw new Error(`Unknown skill id: ${id}`);
  }
}

