import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaperBatch } from "@/lib/ai4scholar/client";

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

    const apiKey = process.env.AI4SCHOLAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI4Scholar API 未配置，请在 .env.local 中设置 AI4SCHOLAR_API_KEY" },
        { status: 500 }
      );
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

    const { data, creditsRemaining, creditsCharged } = await getPaperBatch(
      apiKey,
      limitedIds,
      fields
    );

    return NextResponse.json({
      data: Array.isArray(data) ? data : [],
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
