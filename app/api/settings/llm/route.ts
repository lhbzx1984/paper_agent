import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export type LLMModuleKey = "literature_analysis" | "workspace" | "skills";

export interface LLMModuleConfig {
  base_url?: string;
  api_key?: string;
  model?: string;
}

export const DEFAULT_LLM_MODULE_CONFIG: LLMModuleConfig = {
  base_url: "",
  api_key: "",
  model: "",
};

export const DEFAULT_LLM_SETTINGS: Record<LLMModuleKey, LLMModuleConfig> = {
  literature_analysis: { ...DEFAULT_LLM_MODULE_CONFIG },
  workspace: { ...DEFAULT_LLM_MODULE_CONFIG },
  skills: { ...DEFAULT_LLM_MODULE_CONFIG },
};

function mergeModuleConfig(
  stored: LLMModuleConfig | string | undefined,
  defaults: LLMModuleConfig
): LLMModuleConfig {
  if (!stored) return { ...defaults };
  if (typeof stored === "string") {
    return { ...defaults, model: stored };
  }
  return {
    base_url: stored.base_url || defaults.base_url,
    api_key: stored.api_key ?? defaults.api_key,
    model: stored.model || defaults.model,
  };
}

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
      .from("user_llm_settings")
      .select("settings")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const raw = (data?.settings as Record<string, unknown>) ?? {};
    const merged: Record<LLMModuleKey, LLMModuleConfig> = {
      literature_analysis: mergeModuleConfig(
        raw.literature_analysis as LLMModuleConfig | string,
        DEFAULT_LLM_SETTINGS.literature_analysis
      ),
      workspace: mergeModuleConfig(
        raw.workspace as LLMModuleConfig | string,
        DEFAULT_LLM_SETTINGS.workspace
      ),
      skills: mergeModuleConfig(
        raw.skills as LLMModuleConfig | string,
        DEFAULT_LLM_SETTINGS.skills
      ),
    };

    return NextResponse.json({ settings: merged });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { settings } = body as {
      settings: Record<string, LLMModuleConfig | string>;
    };

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { error: "settings object is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("user_llm_settings")
      .upsert(
        {
          user_id: user.id,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
