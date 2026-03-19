import {
  generateText,
  DEFAULT_CHAT_MODEL,
  type LLMConfig,
} from "../llm/openai";
import {
  searchSimilarChunks,
  getChunksByProject,
  getChunksByProjectViaDocuments,
  getChunksByDocument,
  getProjectContentStats,
} from "../vector/pgvector";
import { embedText } from "../llm/openai";

export interface LiteratureAnalysisResult {
  innovations?: string;
  researchDirections?: string;
  paperStructure?: string;
  experimentAndVerification?: string;
  improvementsOrShortcomings?: string;
  improvementSuggestions?: string;
  /** 当无内容时，提示可执行的操作 */
  hintAction?: { type: "clean-and-reupload"; projectId: string };
}

const MARKDOWN_INSTRUCTION =
  "请使用 Markdown 格式输出，包括标题（##）、有序/无序列表（- 或 1.）、加粗（**）等，使结构清晰易读。";

/** 精简为 6 项：创新点、研究方向、论文结构、实验设计与验证、改进方向与不足、改进意见与创新点 */
const ANALYSIS_PROMPTS = {
  innovations: {
    system:
      "你是科研文献分析专家。根据提供的文献内容，挖掘其中的创新点，包括：方法创新、技术创新、理论创新、应用创新等。输出结构化的创新点列表，每条简明扼要。" +
      MARKDOWN_INSTRUCTION,
    task: "挖掘文献创新点",
  },
  researchDirections: {
    system:
      "你是科研趋势分析专家。根据文献内容，提炼可进一步探索的新研究方向、潜在研究空白、未来工作建议。输出 3-5 条具体可行的研究方向。" +
      MARKDOWN_INSTRUCTION,
    task: "提炼新研究方向",
  },
  paperStructure: {
    system:
      "你是论文结构设计专家。根据文献主题与内容，建议适合该领域的新论文结构框架，包括各章节的定位与逻辑关系。" +
      MARKDOWN_INSTRUCTION,
    task: "设计论文结构",
  },
  experimentAndVerification: {
    system:
      "你是实验与验证专家。根据文献中的方法与应用场景，设计实验方案（数据集、基线、评价指标、消融实验等）与验证方案（复现步骤、对比实验、案例分析等），确保研究可验证、可复现。" +
      MARKDOWN_INSTRUCTION,
    task: "设计实验与验证方案",
  },
  improvementsOrShortcomings: {
    system:
      "你是科研文献评审专家。根据提供的文献内容，分析其未来可改进的方向、现有不足与局限性，指出可提升的空间。" +
      MARKDOWN_INSTRUCTION,
    task: "指出改进方向与不足",
  },
} as const;

/** 改进意见依赖阶段一分析结果，单独定义 */
const IMPROVEMENT_SUGGESTIONS_PROMPT = {
  system:
    "你是科研改进顾问。根据以下文献分析结果（创新点、研究方向、不足、论文结构等），给出具体可操作的改进意见与创新点建议，基于分析基础提出切实可行的改进方向。" +
    MARKDOWN_INSTRUCTION,
  task: "给出改进意见与创新点",
};

function sortChunksByIndex<T extends { metadata?: { index?: number } }>(chunks: T[]): T[] {
  return [...chunks].sort((a, b) => {
    const ia = a.metadata?.index ?? 9999;
    const ib = b.metadata?.index ?? 9999;
    return ia - ib;
  });
}

export async function runLiteratureAnalysis(params: {
  projectId: string;
  documentId?: string;
  model?: string;
  focus?: string;
  llmConfig?: LLMConfig;
}): Promise<LiteratureAnalysisResult> {
  const { projectId, documentId, focus, llmConfig } = params;
  const model = llmConfig?.model ?? params.model ?? DEFAULT_CHAT_MODEL;

  let chunks: { content: string; metadata?: { index?: number } }[];
  if (documentId) {
    chunks = sortChunksByIndex(await getChunksByDocument(documentId));
  } else {
    const query =
      focus ||
      "研究主题、方法、创新点、实验设计、应用场景、未来工作";
    const embedding = await embedText(query);
    let cs = await searchSimilarChunks({
      projectId,
      embedding,
      limit: 12,
    });
    if (cs.length === 0) {
      cs = await getChunksByProject(projectId, 24);
    }
    if (cs.length === 0) {
      cs = await getChunksByProjectViaDocuments(projectId, 24);
    }
    chunks = cs;
  }
  const ragContext = chunks.map((c) => c.content).join("\n\n---\n\n");

  if (!ragContext.trim()) {
    if (documentId) {
      const emptyHint =
        "该文档暂无解析内容。请前往知识库检查该文档是否已成功上传并解析，或尝试重新上传。";
      return {
        innovations: emptyHint,
        researchDirections: emptyHint,
        paperStructure: emptyHint,
        experimentAndVerification: emptyHint,
        improvementsOrShortcomings: emptyHint,
        improvementSuggestions: emptyHint,
      };
    }
    const { documentCount, chunkCount } = await getProjectContentStats(projectId);
    let hint = "知识库暂无文档，请先在知识库中上传 PDF 文献。";
    if (documentCount > 0 && chunkCount === 0) {
      hint =
        "该项目有文档但内容未成功解析入库。请前往知识库点击「清理无内容文档」后重新上传 PDF，或确认已执行数据库迁移 004_embedding_dimension_1024.sql。";
      return {
        innovations: hint,
        researchDirections: hint,
        paperStructure: hint,
        experimentAndVerification: hint,
        improvementsOrShortcomings: hint,
        improvementSuggestions: hint,
        hintAction: { type: "clean-and-reupload", projectId },
      };
    } else if (documentCount === 0) {
      hint =
        "该项目下暂无文档。请确认选择的知识库正确，并前往知识库页面上传 PDF 文献。";
    }
    return {
      innovations: hint,
      researchDirections: hint,
      paperStructure: hint,
      experimentAndVerification: hint,
      improvementsOrShortcomings: hint,
      improvementSuggestions: hint,
    };
  }

  const ctx = ragContext.slice(0, 8000);
  const result: LiteratureAnalysisResult = {};

  // 阶段一：5 项并行
  const phase1Entries = Object.entries(ANALYSIS_PROMPTS) as [
    keyof typeof ANALYSIS_PROMPTS,
    (typeof ANALYSIS_PROMPTS)[keyof typeof ANALYSIS_PROMPTS],
  ][];
  const phase1Outputs = await Promise.all(
    phase1Entries.map(async ([key, { system, task }]) => {
      try {
        const prompt = `【任务】${task}\n\n【文献内容】\n${ctx}\n\n请基于以上文献内容完成分析，使用 Markdown 格式输出结构清晰、可直接参考的结果。`;
        const text = await generateText({
          system,
          prompt,
          model,
          apiKey: llmConfig?.apiKey,
          baseURL: llmConfig?.baseURL,
        });
        return { key, text: text ?? "" };
      } catch {
        return { key, text: `分析失败：${task}` };
      }
    })
  );
  for (const { key, text } of phase1Outputs) {
    (result as Record<string, string>)[key] = text;
  }

  // 阶段二：基于阶段一结果生成改进意见与创新点
  const phase1Keys = phase1Entries.map(([k]) => k);
  const analysisSummary = phase1Outputs
    .filter(({ key }) => phase1Keys.includes(key))
    .map(({ key, text }) => `【${key}】\n${text}`)
    .join("\n\n---\n\n");
  try {
    const prompt = `【任务】${IMPROVEMENT_SUGGESTIONS_PROMPT.task}\n\n【文献内容】\n${ctx}\n\n【已有分析结果】\n${analysisSummary}\n\n请基于以上文献与分析结果，使用 Markdown 格式输出具体改进意见与创新点。`;
    const text = await generateText({
      system: IMPROVEMENT_SUGGESTIONS_PROMPT.system,
      prompt,
      model,
      apiKey: llmConfig?.apiKey,
      baseURL: llmConfig?.baseURL,
    });
    result.improvementSuggestions = text ?? "";
  } catch {
    result.improvementSuggestions = "分析失败：给出改进意见与创新点";
  }

  return result;
}

/** 并行分析，每完成一项即通过 onSection 回调推送，用于流式展示 */
export async function runLiteratureAnalysisStream(params: {
  projectId: string;
  documentId?: string;
  model?: string;
  focus?: string;
  llmConfig?: LLMConfig;
  onSection?: (key: keyof LiteratureAnalysisResult, text: string) => void;
}): Promise<LiteratureAnalysisResult> {
  const { projectId, documentId, focus, onSection, llmConfig } = params;
  const model = llmConfig?.model ?? params.model ?? DEFAULT_CHAT_MODEL;

  let chunks: { content: string; metadata?: { index?: number } }[];
  if (documentId) {
    chunks = sortChunksByIndex(await getChunksByDocument(documentId));
  } else {
    const query =
      focus ||
      "研究主题、方法、创新点、实验设计、应用场景、未来工作";
    const embedding = await embedText(query);
    let cs = await searchSimilarChunks({
      projectId,
      embedding,
      limit: 12,
    });
    if (cs.length === 0) {
      cs = await getChunksByProject(projectId, 24);
    }
    if (cs.length === 0) {
      cs = await getChunksByProjectViaDocuments(projectId, 24);
    }
    chunks = cs;
  }
  const ragContext = chunks.map((c) => c.content).join("\n\n---\n\n");

  if (!ragContext.trim()) {
    if (documentId) {
      const emptyHint =
        "该文档暂无解析内容。请前往知识库检查该文档是否已成功上传并解析，或尝试重新上传。";
      return {
        innovations: emptyHint,
        researchDirections: emptyHint,
        paperStructure: emptyHint,
        experimentAndVerification: emptyHint,
        improvementsOrShortcomings: emptyHint,
        improvementSuggestions: emptyHint,
      };
    }
    const { documentCount, chunkCount } = await getProjectContentStats(projectId);
    let hint = "知识库暂无文档，请先在知识库中上传 PDF 文献。";
    if (documentCount > 0 && chunkCount === 0) {
      hint =
        "该项目有文档但内容未成功解析入库。请前往知识库点击「清理无内容文档」后重新上传 PDF，或确认已执行数据库迁移 004_embedding_dimension_1024.sql。";
      const emptyResult: LiteratureAnalysisResult = {
        innovations: hint,
        researchDirections: hint,
        paperStructure: hint,
        experimentAndVerification: hint,
        improvementsOrShortcomings: hint,
        improvementSuggestions: hint,
        hintAction: { type: "clean-and-reupload", projectId },
      };
      return emptyResult;
    } else if (documentCount === 0) {
      hint =
        "该项目下暂无文档。请确认选择的知识库正确，并前往知识库页面上传 PDF 文献。";
    }
    return {
      innovations: hint,
      researchDirections: hint,
      paperStructure: hint,
      experimentAndVerification: hint,
      improvementsOrShortcomings: hint,
      improvementSuggestions: hint,
    };
  }

  const ctx = ragContext.slice(0, 8000);
  const result: LiteratureAnalysisResult = {};
  const phase1Entries = Object.entries(ANALYSIS_PROMPTS) as [
    keyof typeof ANALYSIS_PROMPTS,
    (typeof ANALYSIS_PROMPTS)[keyof typeof ANALYSIS_PROMPTS],
  ][];

  // 阶段一：5 项并行，每完成一项立即回调
  await Promise.all(
    phase1Entries.map(async ([key, { system, task }]) => {
      try {
        const prompt = `【任务】${task}\n\n【文献内容】\n${ctx}\n\n请基于以上文献内容完成分析，使用 Markdown 格式输出结构清晰、可直接参考的结果。`;
        const text = await generateText({
          system,
          prompt,
          model,
          apiKey: llmConfig?.apiKey,
          baseURL: llmConfig?.baseURL,
        });
        const content = text ?? "";
        (result as Record<string, string>)[key] = content;
        onSection?.(key as keyof LiteratureAnalysisResult, content);
        return { key, text: content };
      } catch {
        const errText = `分析失败：${task}`;
        (result as Record<string, string>)[key] = errText;
        onSection?.(key as keyof LiteratureAnalysisResult, errText);
        return { key, text: errText };
      }
    })
  );

  // 阶段二：基于阶段一结果生成改进意见
  const analysisSummary = phase1Entries
    .map(({ 0: key }) => `【${key}】\n${(result as Record<string, string>)[key] ?? ""}`)
    .join("\n\n---\n\n");
  try {
    const prompt = `【任务】${IMPROVEMENT_SUGGESTIONS_PROMPT.task}\n\n【文献内容】\n${ctx}\n\n【已有分析结果】\n${analysisSummary}\n\n请基于以上文献与分析结果，使用 Markdown 格式输出具体改进意见与创新点。`;
    const text = await generateText({
      system: IMPROVEMENT_SUGGESTIONS_PROMPT.system,
      prompt,
      model,
      apiKey: llmConfig?.apiKey,
      baseURL: llmConfig?.baseURL,
    });
    const content = text ?? "";
    result.improvementSuggestions = content;
    onSection?.("improvementSuggestions", content);
  } catch {
    const errText = "分析失败：给出改进意见与创新点";
    result.improvementSuggestions = errText;
    onSection?.("improvementSuggestions", errText);
  }

  return result;
}
