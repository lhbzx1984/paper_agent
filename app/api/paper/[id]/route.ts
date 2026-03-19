import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaperDetail } from "@/lib/openalex/client";

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

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "论文 ID 不能为空" }, { status: 400 });
    }

    const paper = await getPaperDetail(id.trim());
    if (!paper) {
      return NextResponse.json({ error: "未找到该论文" }, { status: 404 });
    }

    return NextResponse.json({
      data: paper,
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
