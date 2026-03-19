const OPENALEX_BASE_URL = "https://api.openalex.org";

export type OpenAlexSearchMode = "keyword" | "title" | "id";
export type PaperSortMode = "relevance" | "citation";

export interface NormalizedPaperDetail {
  paperId: string;
  title?: string;
  authors?: string[] | { name?: string }[];
  year?: number;
  abstract?: string;
  citationCount?: number;
  doi?: string;
  url?: string;
}

type OpenAlexWork = any;

function normalizeAuthors(work: OpenAlexWork): NormalizedPaperDetail["authors"] {
  const authors = (work?.authorships ?? [])
    .map((a: any) => a?.author?.display_name)
    .filter(Boolean);
  if (!authors.length) return [];
  return authors;
}

function buildTextFromInvertedIndex(inverted: Record<string, number[]> | null | undefined): string {
  if (!inverted || typeof inverted !== "object") return "";
  let maxPos = -1;
  for (const positions of Object.values(inverted)) {
    if (!Array.isArray(positions)) continue;
    for (const p of positions) maxPos = Math.max(maxPos, p);
  }
  if (maxPos < 0) return "";

  const words: string[] = new Array(maxPos + 1).fill("");
  for (const [token, positions] of Object.entries(inverted)) {
    if (!Array.isArray(positions)) continue;
    for (const p of positions) {
      if (typeof p === "number" && p >= 0 && p <= maxPos) words[p] = token;
    }
  }

  let text = words.join(" ").trim();
  // 清理标点前后的多余空格（OpenAlex token 是按词/标点切分的）
  text = text.replace(/\s+([.,;:!?])/g, "$1");
  text = text.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  text = text.replace(/\s+-\s+/g, "-");
  return text.trim();
}

function normalizeWork(work: OpenAlexWork): NormalizedPaperDetail {
  const doi = work?.doi ?? undefined;
  const paperId = work?.id ?? "";
  const title = work?.title ?? undefined;
  const year = work?.publication_year ?? undefined;
  const citationCount = work?.cited_by_count ?? undefined;
  const abstract = buildTextFromInvertedIndex(work?.abstract_inverted_index);

  // 尽量拿一个能跳转的 landing page（用于“查看原文”）
  const url =
    work?.primary_location?.landing_page_url ??
    work?.landing_page_url ??
    (doi ? `https://doi.org/${doi}` : undefined);

  return {
    paperId,
    title,
    authors: normalizeAuthors(work),
    year,
    abstract: abstract || undefined,
    citationCount,
    doi,
    url,
  };
}

async function openalexFetch<T>(path: string) {
  const res = await fetch(`${OPENALEX_BASE_URL}${path}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAlex request failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function searchPapers(params: {
  query: string;
  mode: OpenAlexSearchMode;
  limit: number;
  offset: number;
  year?: string;
  openAccessOnly?: boolean;
  sort?: PaperSortMode;
}) {
  const {
    query,
    mode,
    limit,
    offset,
    year,
    openAccessOnly,
    sort = "relevance",
  } = params;

  const page = Math.floor(offset / Math.max(1, limit)) + 1;
  const perPage = Math.max(1, Math.min(limit, 50));

  const filters: string[] = [];
  if (year) {
    // 用 publication year 范围过滤（OpenAlex 支持从/到发布日期过滤）
    filters.push(`from_publication_date:${year}-01-01`);
    filters.push(`to_publication_date:${year}-12-31`);
  }
  if (openAccessOnly) {
    filters.push(`is_oa:true`);
  }

  // 搜索/筛选逻辑
  let search = query.trim();
  let filterPart = filters.length ? filters.join(",") : undefined;
  let sortParam = sort === "citation" ? "cited_by_count:desc" : "relevance_score:desc";

  if (mode === "id") {
    // 优先按 DOI 过滤；否则退回 search
    const q = query.trim();
    const looksLikeDoi = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i.test(q);
    if (looksLikeDoi) {
      filterPart = filters.length ? `${filters.join(",")},doi:${q}` : `doi:${q}`;
      search = "";
      // filter 模式下 relevance_score 可能无意义，改按引用排序或出版年
      sortParam = sort === "citation" ? "cited_by_count:desc" : "publication_year:desc";
    }
  }

  const qs: string[] = [];
  qs.push(`per-page=${perPage}`);
  qs.push(`page=${page}`);
  qs.push(`mailto=anonymous@example.com`);
  if (search) qs.push(`search=${encodeURIComponent(search)}`);
  if (filterPart) qs.push(`filter=${encodeURIComponent(filterPart)}`);
  if (sortParam) qs.push(`sort=${encodeURIComponent(sortParam)}`);

  const path = `/works?${qs.join("&")}`;
  const result = await openalexFetch<any>(path);

  const works: OpenAlexWork[] = result?.results ?? [];
  return {
    total: result?.meta?.count ?? 0,
    data: works.map(normalizeWork),
  };
}

export async function getPaperDetail(inputIdOrDoi: string): Promise<NormalizedPaperDetail | null> {
  const id = inputIdOrDoi.trim();
  if (!id) return null;

  // 若是 OpenAlex work url：.../W123
  if (id.includes("/works/") || id.includes("/W")) {
    const workId = id.split("/").pop() || id;
    try {
      const work = await openalexFetch<any>(
        `/works/${encodeURIComponent(workId)}`
      );
      if (!work) return null;
      return normalizeWork(work);
    } catch {
      // fallthrough to DOI/search
    }
  }

  // DOI
  const looksLikeDoi = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i.test(id);
  if (looksLikeDoi) {
    const encodedFilter = encodeURIComponent(`doi:${id}`);
    const result = await openalexFetch<any>(`/works?filter=${encodedFilter}&per-page=1&page=1`);
    const work = result?.results?.[0];
    return work ? normalizeWork(work) : null;
  }

  // 回退：用 search + 每页 1 条
  const result = await openalexFetch<any>(
    `/works?search=${encodeURIComponent(id)}&per-page=1&page=1&mailto=anonymous@example.com&sort=relevance_score:desc`
  );
  const work = result?.results?.[0];
  return work ? normalizeWork(work) : null;
}

