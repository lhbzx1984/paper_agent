/**
 * AI4Scholar REST API 客户端
 * 文档: https://ai4scholar.net/docs
 */

const BASE_URL = "https://www.ai4scholar.net/graph/v1";

export interface Ai4ScholarResponse<T> {
  data: T;
  creditsRemaining?: string | null;
  creditsCharged?: string | null;
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    params?: Record<string, string>;
    body?: unknown;
    apiKey: string;
  }
): Promise<Ai4ScholarResponse<T> & { raw: Response }> {
  const { method = "GET", params, body, apiKey } = options;
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };

  if (!res.ok) {
    throw new Error(data?.message ?? data?.error ?? `请求失败: ${res.status}`);
  }

  return {
    data,
    creditsRemaining: res.headers.get("X-Credits-Remaining"),
    creditsCharged: res.headers.get("X-Credits-Charged"),
    raw: res,
  };
}

export type SearchMode = "keyword" | "title" | "id";

/** 论文搜索 - 支持多种检索方式 */
export async function searchPapers(
  apiKey: string,
  params: {
    query: string;
    limit?: number;
    offset?: number;
    year?: string;
    fields?: string;
    mode?: SearchMode;
    openAccessOnly?: boolean;
  }
) {
  const q = params.query.trim();
  const mode = params.mode ?? "keyword";

  if (mode === "id") {
    const { data } = await getPaperDetail(apiKey, q, params.fields);
    return {
      data: { total: 1, data: data ? [data] : [] },
      creditsRemaining: null,
      creditsCharged: null,
      raw: {} as Response,
    } as Awaited<ReturnType<typeof request<{ total: number; data: unknown[] }>>>;
  }

  if (mode === "title") {
    const p: Record<string, string> = { query: q };
    if (params.fields) p.fields = params.fields;
    const res = await request<unknown>(`/paper/search/match`, {
      method: "GET",
      params: p,
      apiKey,
    });
    const d = res.data as { paperId?: string } | null;
    return {
      ...res,
      data: {
        total: d?.paperId ? 1 : 0,
        data: d?.paperId ? [res.data] : [],
      },
    } as Awaited<ReturnType<typeof request<{ total: number; data: unknown[] }>>>;
  }

  const p: Record<string, string> = {
    query: q,
    limit: String(Math.min(params.limit ?? 10, 50)),
  };
  // Semantic Scholar API 最大 offset 约 10000，超出会报错
  if (params.offset != null && params.offset > 0) {
    p.offset = String(Math.min(params.offset, 9990));
  }
  if (params.year) p.year = params.year;
  if (params.fields) p.fields = params.fields ?? "paperId,title,abstract,authors,year,citationCount,openAccessPdf";
  if (params.openAccessOnly) p.openAccessPdf = "";
  return request<{ total: number; data: unknown[] }>("/paper/search", {
    method: "GET",
    params: p,
    apiKey,
  });
}

/** 获取论文详情（支持 paperId、DOI、arXiv ID、PMID 等） */
export async function getPaperDetail(
  apiKey: string,
  paperId: string,
  fields?: string
) {
  const params: Record<string, string> = {};
  if (fields) params.fields = fields;
  return request<unknown>(`/paper/${encodeURIComponent(paperId)}`, {
    method: "GET",
    params: Object.keys(params).length ? params : undefined,
    apiKey,
  });
}

/** 批量获取论文详情 */
export async function getPaperBatch(
  apiKey: string,
  ids: string[],
  fields?: string
) {
  const body: { ids: string[]; fields?: string } = { ids };
  if (fields) body.fields = fields;
  return request<unknown[]>("/paper/batch", {
    method: "POST",
    body,
    apiKey,
  });
}
