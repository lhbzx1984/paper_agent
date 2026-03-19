import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { listSkills } from "@/lib/skills/registry";

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
    const ids = searchParams.get("ids")?.split(",").filter(Boolean);
    const type = searchParams.get("type") ?? "all"; // all | builtin | custom

    const result: unknown[] = [];

    if (type !== "custom" && (!ids || ids.length === 0)) {
      const builtin = listSkills();
      result.push(
        ...builtin.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          type: "builtin",
        }))
      );
    }

    if (type !== "builtin") {
      let query = supabase
        .from("custom_skills")
        .select("id, name, description, system_prompt, prompt_template, created_at")
        .eq("user_id", user.id);

      if (ids && ids.length > 0) {
        query = query.in("id", ids);
      }

      const { data: custom } = await query.order("created_at", {
        ascending: false,
      });

      if (custom) {
        result.push(
          ...custom.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            system_prompt: s.system_prompt,
            prompt_template: s.prompt_template,
            type: "custom",
          }))
        );
      }
    }

    return new NextResponse(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="skills_export_${Date.now()}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
