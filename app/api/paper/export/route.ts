import { NextRequest, NextResponse } from "next/server";
import { convertMarkdownToDocx } from "@mohtasham/md-to-docx";
import { markdownToLatex } from "@/lib/markdown-to-latex";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { content, format, title } = body as {
    content: string;
    format: "markdown" | "txt" | "docx" | "latex";
    title?: string;
  };

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const baseName = (title ?? "paper").replace(/[<>:"/\\|?*]/g, "_");

  if (format === "markdown") {
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.md"`,
      },
    });
  }

  if (format === "txt") {
    const plain = content.replace(/#{1,6}\s+/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
    return new NextResponse(plain, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.txt"`,
      },
    });
  }

  if (format === "latex") {
    const latex = markdownToLatex(content);
    return new NextResponse(latex, {
      status: 200,
      headers: {
        "Content-Type": "text/x-tex; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.tex"`,
      },
    });
  }

  if (format === "docx") {
    try {
      const blob = await convertMarkdownToDocx(content, {
        documentType: "document",
        style: { paragraphAlignment: "JUSTIFIED" },
      });
      const buffer = Buffer.from(await blob.arrayBuffer());
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${baseName}.docx"`,
        },
      });
    } catch (err) {
      console.error("[paper export docx]", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Word 导出失败" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}
