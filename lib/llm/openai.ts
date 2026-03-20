import OpenAI from "openai";

// 嵌入模型：仅使用智谱 Embedding-3
const zhipuKey = process.env.ZHIPU_API_KEY;
const ZHIPU_EMBED_BASE = "https://open.bigmodel.cn/api/paas/v4";

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
  const key = config?.apiKey?.trim();
  const base = config?.baseURL?.trim();
  if (!key || !base) return null;
  return new OpenAI({ apiKey: key, baseURL: base });
}

export async function generateText(params: {
  system: string;
  prompt: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
}) {
  const client = getClient({ apiKey: params.apiKey, baseURL: params.baseURL });
  if (!client) {
    throw new Error(
      "请在对应模块的‘大模型设置’中填写 api_key 和 base_url（不再使用环境变量回退）。"
    );
  }

  const model = params.model?.trim();
  if (!model) {
    throw new Error("请在对应模块的‘大模型设置’中填写 model（不再使用默认模型）。");
  }

  const { system, prompt } = params;

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
      // 超时：只重试一次，且不切换到任何默认模型
      return generateText({ ...params, model });
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
  const client = getClient({ apiKey: params.apiKey, baseURL: params.baseURL });
  if (!client) {
    throw new Error(
      "请在对应模块的‘大模型设置’中填写 api_key 和 base_url（不再使用环境变量回退）。"
    );
  }

  const model = params.model?.trim();
  if (!model) {
    throw new Error("请在对应模块的‘大模型设置’中填写 model（不再使用默认模型）。");
  }

  const { system, prompt, _noRetry } = params;
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
      full = "";
      for await (const t of generateTextStream({
        ...params,
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
