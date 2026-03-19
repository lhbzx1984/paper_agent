import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("custom_skills")
      .select("id, name, description, system_prompt, prompt_template, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ skills: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
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
    const { name, description, system_prompt, prompt_template } = body as {
      name: string;
      description?: string;
      system_prompt: string;
      prompt_template?: string;
    };

    if (!name?.trim() || !system_prompt?.trim()) {
      return NextResponse.json(
        { error: "name and system_prompt are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("custom_skills")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() ?? null,
        system_prompt: system_prompt.trim(),
        prompt_template: prompt_template?.trim() ?? "用户输入：\n{{input}}",
      })
      .select("id, name, description, system_prompt, prompt_template, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ skill: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
