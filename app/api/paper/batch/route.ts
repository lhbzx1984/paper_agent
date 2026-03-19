import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaperDetail } from "@/lib/openalex/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ids, fields } = body as { ids?: string[]; fields?: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids 必须为非空数组" },
        { status: 400 }
      );
    }

    const limitedIds = ids.slice(0, 100);

    const data = await Promise.all(
      limitedIds.map(async (id) => {
        const paper = await getPaperDetail(String(id));
        return paper;
      })
    );

    return NextResponse.json({
      data: data.filter(Boolean),
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
