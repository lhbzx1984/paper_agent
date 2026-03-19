import { generateText } from "../llm/openai";
import { executeTopicGenerate } from "../../skills/topic-generate";
import { executeKeywordSkill } from "../../skills/keywords";
import { searchSimilarChunks } from "../vector/pgvector";
import { embedText } from "../llm/openai";
import { executeSkill } from "../skills/registry";

export interface ResearchState {
  userInput: string;
  topic?: string;
  keywords?: string[];
  ragContext?: string;
  summary?: string;
  outline?: string[];
  paper?: string;
}

export interface WorkflowOptions {
  projectId?: string;
  model?: string;
  skillIds?: string[];
  customSkillsMap?: Record<
    string,
    { system_prompt: string; prompt_template: string }
  >;
}

export async function runResearchWorkflow(
  userInput: string,
  options: WorkflowOptions = {}
): Promise<ResearchState> {
  const {
    projectId,
    model = "gpt-5.4",
    skillIds = [],
    customSkillsMap = {},
  } = options;

  const BUILTIN_CORE = ["topic-generate", "keywords"];
  let skillContext = "";
  for (const id of skillIds) {
    if (BUILTIN_CORE.includes(id)) continue; /* 已在主流程中执行 */
    try {
      const custom = customSkillsMap[id];
      const res = await executeSkill(id, { input: userInput }, custom);
      const out =
        typeof res === "object" && res !== null && "output" in res
          ? String((res as { output: unknown }).output)
          : JSON.stringify(res);
      skillContext += `\n【${id}】\n${out}\n`;
    } catch {
      /* 单个技能失败不阻塞 */
    }
  }

  const topicResult = await executeTopicGenerate({
    domain: undefined,
    interests: userInput,
  });
  const topic = topicResult.topics[0];

  const kwResult = await executeKeywordSkill({
    topic,
    context: userInput,
  });

  let ragContext = "";
  if (projectId) {
    try {
      const embedding = await embedText(
        `${userInput} ${topic} ${kwResult.keywords.slice(0, 5).join(" ")}`
      );
      const chunks = await searchSimilarChunks({
        projectId,
        embedding,
        limit: 6,
      });
      ragContext = chunks.map((c) => c.content).join("\n\n---\n\n");
    } catch {
      /* RAG 失败时继续，不阻塞 */
    }
  }

  const system =
    "你是科研助手，请根据用户需求、研究主题与关键词，给出一段 200 字左右的研究方向概述。";
  const prompt = `用户需求: ${userInput}\n主题: ${topic}\n关键词: ${kwResult.keywords.join(
    ", "
  )}${skillContext ? `\n\n技能输出:\n${skillContext.slice(0, 3000)}` : ""}${ragContext ? `\n\n相关文献片段:\n${ragContext.slice(0, 2000)}` : ""}`;
  const summary = await generateText({ system, prompt, model });

  const outlineSystem =
    "你是论文写作助手。请根据研究主题与概述，生成论文大纲（中文），每行一个章节标题，如：1. 引言、2. 相关工作、3. 方法...";
  const outlinePrompt = `主题: ${topic}\n概述: ${summary}`;
  const outlineText = await generateText({ system: outlineSystem, prompt: outlinePrompt, model });
  const outline = outlineText
    .split("\n")
    .map((s) => s.replace(/^\d+[\.\、]\s*/, "").trim())
    .filter(Boolean);

  const paperSystem =
    "你是论文写作助手。请根据大纲与文献上下文，撰写一篇完整的学术论文正文（中文），包含各章节内容，格式清晰，可分段。";
  const paperPrompt = `主题: ${topic}\n概述: ${summary}\n大纲:\n${outline.join("\n")}${
    skillContext ? `\n\n技能输出:\n${skillContext.slice(0, 3000)}` : ""
  }${ragContext ? `\n\n参考文献:\n${ragContext.slice(0, 3000)}` : ""}`;
  const paper = await generateText({ system: paperSystem, prompt: paperPrompt, model });

  return {
    userInput,
    topic,
    keywords: kwResult.keywords,
    ragContext: ragContext || undefined,
    summary: summary ?? "",
    outline,
    paper: paper ?? "",
  };
}

