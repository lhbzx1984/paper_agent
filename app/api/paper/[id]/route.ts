import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaperDetail } from "@/lib/ai4scholar/client";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "论文 ID 不能为空" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const fields = searchParams.get("fields") ?? undefined;

    const { data, creditsRemaining, creditsCharged } = await getPaperDetail(
      apiKey,
      id.trim(),
      fields
    );

    return NextResponse.json({
      data,
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
