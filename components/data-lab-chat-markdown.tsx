"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { Components } from "react-markdown";

function childrenToPlainText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childrenToPlainText).join("");
  if (React.isValidElement(node)) {
    return childrenToPlainText(
      (node.props as { children?: React.ReactNode }).children,
    );
  }
  return "";
}

function DataLabFencedPreBlock({
  fenceLabel,
  children,
  preClassName,
  ...preRest
}: {
  fenceLabel: string;
  children: React.ReactNode;
  preClassName?: string;
} & Omit<React.ComponentProps<"pre">, "children" | "className">) {
  const [removed, setRemoved] = useState(false);
  const [copied, setCopied] = useState(false);

  const plain = useMemo(() => childrenToPlainText(children), [children]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }, [plain]);

  if (removed) {
    return (
      <div className="data-lab-fenced-code data-lab-fenced-removed my-3 rounded-lg border border-dashed border-zinc-300/90 dark:border-zinc-600 px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        已隐藏该代码块
        <button
          type="button"
          className="ml-2 font-medium text-sky-600 dark:text-sky-400 hover:underline"
          onClick={() => setRemoved(false)}
        >
          撤销
        </button>
      </div>
    );
  }

  return (
    <div className="data-lab-fenced-code my-3 rounded-xl border border-sky-400/30 dark:border-sky-500/25 overflow-hidden shadow-sm bg-sky-50/50 dark:bg-sky-950/20">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-sky-900 dark:text-sky-100/95 bg-sky-100/80 dark:bg-sky-900/60 border-b border-sky-200/70 dark:border-sky-800/50">
        <span
          className="inline-block h-2 w-2 rounded-sm bg-sky-500 shadow-sm shrink-0"
          aria-hidden
        />
        {fenceLabel}
      </div>
      <pre
        className={`m-0 max-h-[min(52vh,400px)] overflow-auto px-3 py-2.5 text-[12px] font-mono leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white/80 dark:bg-zinc-950/80 ${preClassName ?? ""}`}
        {...preRest}
      >
        {children}
      </pre>
      <div className="flex items-center justify-end gap-3 px-3 py-1.5 border-t border-sky-200/60 dark:border-sky-800/45 bg-sky-50/90 dark:bg-sky-950/35">
        <button
          type="button"
          onClick={handleCopy}
          className="text-[11px] font-medium text-sky-800 dark:text-sky-200/95 hover:text-sky-950 dark:hover:text-sky-50 underline-offset-2 hover:underline"
        >
          {copied ? "已复制" : "复制"}
        </button>
        <button
          type="button"
          onClick={() => setRemoved(true)}
          className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 underline-offset-2 hover:underline"
        >
          删除
        </button>
      </div>
    </div>
  );
}

/** 对话里区分：模型给出的 fenced 代码（天青标题） vs 附录执行结果（翠绿，见 E2bSandboxResultPanel） */
export function getDataLabChatMarkdownComponents(
  role: "user" | "assistant",
): Components {
  const fenceLabel = role === "assistant" ? "模型生成的代码" : "代码";

  return {
    pre({ children, node, className, ...props }) {
      return (
        <DataLabFencedPreBlock fenceLabel={fenceLabel} preClassName={className} {...props}>
          {children}
        </DataLabFencedPreBlock>
      );
    },
    code({ className, children, ...props }) {
      const text = String(children ?? "");
      const hasLang =
        typeof className === "string" && /\blanguage-/.test(className);
      const multiline = text.includes("\n");
      if (hasLang || multiline) {
        return (
          <code
            className={`${className ?? ""} block whitespace-pre bg-transparent p-0 text-inherit`}
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          className="rounded px-1.5 py-0.5 text-[0.88em] font-mono bg-zinc-200/85 dark:bg-zinc-600/80 text-zinc-900 dark:text-zinc-50"
          {...props}
        >
          {children}
        </code>
      );
    },
  };
}
