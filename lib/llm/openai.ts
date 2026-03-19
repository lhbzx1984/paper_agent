import OpenAI from "openai";

const deepseekKey = process.env.DEEPSEEK_API_KEY;
const deepseekBase = process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com/v1";

// Chat：仅使用 DeepSeek
const chatClient = deepseekKey
  ? new OpenAI({ apiKey: deepseekKey, baseURL: deepseekBase })
  : null;

// 嵌入模型：仅使用智谱 Embedding-3
const zhipuKey = process.env.ZHIPU_API_KEY;
const ZHIPU_EMBED_BASE = "https://open.bigmodel.cn/api/paas/v4";

export const DEFAULT_CHAT_MODEL = "deepseek-chat";
export const FALLBACK_CHAT_MODEL = "deepseek-reasoner";
export const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

/** 可选 LLM 配置（用户设置覆盖） */
export interface LLMConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

/** 向量嵌入维度（智谱 Embedding-3），需与 pgvector 表结构一致 */
export const ZHIPU_EMBED_DIMENSIONS = 1024;

/** 是否为超时类错误 */
function isTimeoutError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /timed out|timeout|Timeout/i.test(msg);
}

function getClient(config?: LLMConfig): OpenAI | null {
  const key = (config?.apiKey?.trim() || deepseekKey) || null;
  const base = config?.baseURL?.trim() || deepseekBase;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: base });
}

export async function generateText(params: {
  system: string;
  prompt: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
}) {
  const client = getClient({ apiKey: params.apiKey, baseURL: params.baseURL }) ?? chatClient;
  if (!client) {
    throw new Error("DEEPSEEK_API_KEY 或大模型设置中的 api_key 未配置");
  }

  const { system, prompt, model = DEFAULT_CHAT_MODEL } = params;

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });
    return res.choices[0]?.message.content ?? "";
  } catch (e) {
    if (isTimeoutError(e)) {
      const alt =
        model === DEFAULT_CHAT_MODEL ? FALLBACK_CHAT_MODEL : DEFAULT_CHAT_MODEL;
      return generateText({ ...params, model: alt });
    }
    throw e;
  }
}

/** 流式生成文本，逐块 yield */
export async function* generateTextStream(
  params: {
    system: string;
    prompt: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
  } & { _noRetry?: boolean },
): AsyncGenerator<string, string, unknown> {
  const client = getClient({ apiKey: params.apiKey, baseURL: params.baseURL }) ?? chatClient;
  if (!client) {
    throw new Error("DEEPSEEK_API_KEY 或大模型设置中的 api_key 未配置");
  }

  const { system, prompt, model = DEFAULT_CHAT_MODEL, _noRetry } = params;
  let full = "";

  const doStream = async function* () {
    const stream = await client!.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        full += text;
        yield text;
      }
    }
  };

  try {
    for await (const t of doStream()) {
      yield t;
    }
  } catch (e) {
    if (!_noRetry && isTimeoutError(e)) {
      const alt =
        model === DEFAULT_CHAT_MODEL ? FALLBACK_CHAT_MODEL : DEFAULT_CHAT_MODEL;
      full = "";
      for await (const t of generateTextStream({
        ...params,
        model: alt,
        _noRetry: true,
      })) {
        full += t;
        yield t;
      }
      return full;
    }
    throw e;
  }
  return full;
}

/** 智谱 API 直接调用，确保 dimensions 参数生效 */
async function zhipuEmbed(input: string): Promise<number[]> {
  if (!zhipuKey) return [];
  const res = await fetch(`${ZHIPU_EMBED_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${zhipuKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "embedding-3",
      input,
      dimensions: ZHIPU_EMBED_DIMENSIONS,
    }),
  });
  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `智谱 API 错误: ${res.status}`);
  }
  const emb = data?.data?.[0]?.embedding;
  return Array.isArray(emb) ? emb : [];
}

export async function embedText(input: string) {
  if (!zhipuKey) {
    throw new Error("ZHIPU_API_KEY 未配置（用于向量检索）");
  }
  return zhipuEmbed(input);
}
