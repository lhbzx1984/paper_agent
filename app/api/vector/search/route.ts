import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/llm/openai";
import { searchSimilarChunks } from "@/lib/vector/pgvector";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, projectId, limit } = body as {
    query: string;
    projectId: string;
    limit?: number;
  };

  if (!query || !projectId) {
    return NextResponse.json(
      { error: "query and projectId are required" },
      { status: 400 },
    );
  }

  const embedding = await embedText(query);
  const chunks = await searchSimilarChunks({
    projectId,
    embedding,
    limit: limit ?? 8,
  });

  return NextResponse.json({ chunks });
}

