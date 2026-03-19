import { NextRequest, NextResponse } from "next/server";
import { listSkills, executeSkill } from "@/lib/skills/registry";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const builtin = listSkills();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let custom: unknown[] = [];
    if (user) {
      const { data } = await supabase
        .from("custom_skills")
        .select("id, name, description, system_prompt, prompt_template")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      custom = (data ?? []).map((s) => ({
        ...s,
        type: "custom",
      }));
    }

    return NextResponse.json({
      skills: [...builtin, ...custom],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, input } = body as { id: string; input: unknown };

    const builtin = listSkills();
    const builtinSkill = builtin.find((s) => s.id === id);

    if (builtinSkill) {
      const result = await executeSkill(id, input);
      return NextResponse.json({ result });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: custom } = await supabase
      .from("custom_skills")
      .select("system_prompt, prompt_template")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!custom) {
      return NextResponse.json({ error: "Unknown skill id" }, { status: 400 });
    }

    const result = await executeSkill(id, input, custom);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

