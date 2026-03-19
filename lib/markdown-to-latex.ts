/** 将 Markdown 转为基本 LaTeX 文档 */
export function markdownToLatex(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let codeLang = "";

  function escapeLatex(s: string): string {
    return s
      .replace(/\\/g, "\\\\")
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}")
      .replace(/#/g, "\\#")
      .replace(/\$/g, "\\$")
      .replace(/&/g, "\\&")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")
      .replace(/\^/g, "\\^{}");
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push("\\end{lstlisting}");
        inCodeBlock = false;
      } else {
        codeLang = line.slice(3).trim() || "text";
        out.push("\\begin{lstlisting}[language=" + codeLang + "]");
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(escapeLatex(line));
      continue;
    }

    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const h4 = line.match(/^####\s+(.+)$/);

    if (h1) {
      out.push("\\section{" + escapeLatex(h1[1].trim()) + "}");
      continue;
    }
    if (h2) {
      out.push("\\subsection{" + escapeLatex(h2[1].trim()) + "}");
      continue;
    }
    if (h3) {
      out.push("\\subsubsection{" + escapeLatex(h3[1].trim()) + "}");
      continue;
    }
    if (h4) {
      out.push("\\paragraph{" + escapeLatex(h4[1].trim()) + "}");
      continue;
    }

    if (line.trim() === "" || line.trim() === "---") {
      out.push("");
      continue;
    }

    if (line.startsWith("> ")) {
      out.push("\\begin{quote}");
      out.push(escapeLatex(line.slice(2)));
      out.push("\\end{quote}");
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push("\\begin{itemize}");
      out.push("\\item " + escapeLatex(line.slice(2).trim()));
      let j = i + 1;
      while (j < lines.length && /^(\s*[-*]\s+)/.test(lines[j])) {
        const item = lines[j].replace(/^\s*[-*]\s+/, "").trim();
        out.push("\\item " + escapeLatex(item));
        j++;
        i = j - 1;
      }
      out.push("\\end{itemize}");
      continue;
    }

    const bold: string[] = [];
    const italic: string[] = [];
    const code: string[] = [];
    const PL = "\uE000"; // Unicode private use placeholder
    let text = line
      .replace(/\*\*(.+?)\*\*/g, (_, m) => {
        bold.push(escapeLatex(m));
        return PL + "B" + PL;
      })
      .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, (_, m) => {
        italic.push(escapeLatex(m));
        return PL + "I" + PL;
      })
      .replace(/`(.+?)`/g, (_, m) => {
        code.push(escapeLatex(m));
        return PL + "C" + PL;
      });
    let bi = 0, ii = 0, ci = 0;
    text = escapeLatex(text)
      .replace(new RegExp(PL + "B" + PL, "g"), () => "\\textbf{" + (bold[bi++] ?? "") + "}")
      .replace(new RegExp(PL + "I" + PL, "g"), () => "\\textit{" + (italic[ii++] ?? "") + "}")
      .replace(new RegExp(PL + "C" + PL, "g"), () => "\\texttt{" + (code[ci++] ?? "") + "}");
    out.push(text + "\\\\");
  }

  const body = out.join("\n");
  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[UTF8]{ctex}
\\usepackage{listings}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{left=2.5cm,right=2.5cm,top=2.5cm,bottom=2.5cm}

\\begin{document}

${body}

\\end{document}
`;
}
