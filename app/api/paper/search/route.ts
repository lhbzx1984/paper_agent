import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { searchPapers } from "@/lib/openalex/client";

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

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10) || 10, 50);
    const offset = Math.min(9990, Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0));
    const year = searchParams.get("year") ?? undefined;
    const mode = (searchParams.get("mode") as "keyword" | "title" | "id") ?? "keyword";
    const openAccessOnly = searchParams.get("openAccessOnly") === "1";
    const sort = (searchParams.get("sort") as "relevance" | "citation") ?? undefined;

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "query 参数不能为空" },
        { status: 400 }
      );
    }

    const { data, total } = await searchPapers({
      query: query.trim(),
      limit,
      offset,
      year,
      mode,
      openAccessOnly,
      sort,
    });

    return NextResponse.json({
      total,
      data,
      creditsRemaining: null,
      creditsCharged: null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
