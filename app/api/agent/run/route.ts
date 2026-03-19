import { NextRequest, NextResponse } from "next/server";
import { runResearchWorkflow } from "@/lib/langgraph/workflow";
import { createClient } from "@/utils/supabase/server";
import { listSkills } from "@/lib/skills/registry";

export const runtime = "nodejs";
/** Vercel Hobby 计划上限为 300 秒 */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input, projectId, model, skillIds } = body as {
      input: string;
      projectId?: string;
      model?: string;
      skillIds?: string[];
    };

    if (!input?.trim()) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const builtinIds = new Set(listSkills().map((s) => s.id));
    const customIds = (skillIds ?? []).filter((id) => !builtinIds.has(id));

    let customSkillsMap: Record<
      string,
      { system_prompt: string; prompt_template: string }
    > = {};
    if (customIds.length > 0) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("custom_skills")
          .select("id, system_prompt, prompt_template")
          .eq("user_id", user.id)
          .in("id", customIds);
        for (const s of data ?? []) {
          customSkillsMap[s.id] = {
            system_prompt: s.system_prompt,
            prompt_template: s.prompt_template,
          };
        }
      }
    }

    const result = await runResearchWorkflow(input, {
      projectId,
      model,
      skillIds: skillIds ?? [],
      customSkillsMap,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

