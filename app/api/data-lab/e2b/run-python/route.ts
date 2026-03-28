import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveE2bApiKey } from "@/lib/e2b/resolve-api-key";
import { runE2bPython } from "@/lib/e2b/execute-python";
import {
  parseDownloadPaths,
  parsePipPackages,
} from "@/lib/e2b/sandbox-extras";

export const runtime = "nodejs";
export const maxDuration = 300;

type UploadEntry = { path: string; content: string };

function normalizeUploads(raw: unknown): UploadEntry[] | null {
  if (!Array.isArray(raw)) return [];
  const out: UploadEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const path = String((item as { path?: unknown }).path ?? "").trim();
    const content = String((item as { content?: unknown }).content ?? "");
    if (!path) continue;
    out.push({ path, content });
    if (out.length > 20) return null;
  }
  return out;
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

    const apiKey = await resolveE2bApiKey(supabase, user.id);
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "未解析到 E2B API Key。请确认：① 项目根目录 .env.local 中已设置 E2B_API_KEY（或 E2B_KEY）并已重启 next dev / 重新部署；② 或在 Supabase 表 user_data_lab_e2b 中已保存当前登录用户的 Key；③ 部署平台（如 Vercel）需在项目 Environment Variables 中单独配置。",
        },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code : "";
    const timeoutMs =
      typeof body.timeoutMs === "number" &&
      body.timeoutMs >= 5000 &&
      body.timeoutMs <= 110_000
        ? body.timeoutMs
        : 60_000;

    if (!code.trim()) {
      return NextResponse.json({ error: "code 不能为空" }, { status: 400 });
    }

    const uploads = normalizeUploads(body.uploadFiles);
    if (uploads === null) {
      return NextResponse.json(
        { error: "uploadFiles 过多（上限 20 个）" },
        { status: 400 },
      );
    }

    let pipPackages: string[] = [];
    if (typeof body.pipPackages === "string") {
      pipPackages = parsePipPackages(body.pipPackages);
    } else if (Array.isArray(body.pipPackages)) {
      pipPackages = parsePipPackages(
        body.pipPackages.map((x: unknown) => String(x)).join(" "),
      );
    }

    let downloadPaths: string[] = [];
    if (typeof body.downloadPaths === "string") {
      downloadPaths = parseDownloadPaths(body.downloadPaths);
    } else if (Array.isArray(body.downloadPaths)) {
      downloadPaths = parseDownloadPaths(
        body.downloadPaths.map((x: unknown) => String(x)).join(","),
      );
    }

    const r = await runE2bPython({
      code,
      apiKey,
      userId: user.id,
      feature: "data_lab_http",
      timeoutMs,
      uploadFiles: uploads.length ? uploads : undefined,
      pipPackages: pipPackages.length ? pipPackages : undefined,
      downloadPaths: downloadPaths.length ? downloadPaths : undefined,
    });

    if (!r.ok || !r.payload) {
      return NextResponse.json(
        {
          error: r.error ?? "E2B 执行失败",
          pipResult: r.pipResult,
          sandboxId: r.sandboxId,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      sandboxId: r.sandboxId,
      pipResult: r.pipResult,
      downloadedFiles: r.downloadedFiles,
      ...r.payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || "E2B 执行失败" },
      { status: 500 },
    );
  }
}
