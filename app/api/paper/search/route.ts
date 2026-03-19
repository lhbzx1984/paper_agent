import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { searchPapers } from "@/lib/ai4scholar/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.AI4SCHOLAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI4Scholar API 未配置，请在 .env.local 中设置 AI4SCHOLAR_API_KEY" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10) || 10, 50);
    const offset = Math.min(9990, Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0));
    const year = searchParams.get("year") ?? undefined;
    const mode = (searchParams.get("mode") as "keyword" | "title" | "id") ?? "keyword";
    const openAccessOnly = searchParams.get("openAccessOnly") === "1";

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query 参数不能为空" },
        { status: 400 }
      );
    }

    const fields = "paperId,title,abstract,authors,year,citationCount,openAccessPdf,externalIds";
    const { data, creditsRemaining, creditsCharged } = await searchPapers(
      apiKey,
      {
        query: query.trim(),
        limit,
        offset,
        year,
        fields,
        mode,
        openAccessOnly,
      }
    );

    return NextResponse.json({
      total: data.total ?? 0,
      data: data.data ?? [],
      creditsRemaining,
      creditsCharged,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
