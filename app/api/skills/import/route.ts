import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

interface ImportSkill {
  name: string;
  description?: string;
  system_prompt: string;
  prompt_template?: string;
}

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
    const items = Array.isArray(body) ? body : [body];
    const skills = items as ImportSkill[];

    const inserted: unknown[] = [];
    for (const s of skills) {
      if (!s.name?.trim() || !s.system_prompt?.trim()) continue;

      const { data, error } = await supabase
        .from("custom_skills")
        .insert({
          user_id: user.id,
          name: s.name.trim(),
          description: s.description?.trim() ?? null,
          system_prompt: s.system_prompt.trim(),
          prompt_template: s.prompt_template?.trim() ?? "用户输入：\n{{input}}",
        })
        .select("id, name, created_at")
        .single();

      if (!error) inserted.push(data);
    }

    return NextResponse.json({ imported: inserted.length, skills: inserted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
