import { useState } from "react";
import { cn } from "../utils/cn";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language = "text", className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard API niedostępne — ignorujemy po cichu
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/80 shadow-inner",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-violet-500 hover:bg-violet-600/20 hover:text-violet-200"
        >
          {copied ? "Skopiowano ✓" : "Kopiuj"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto px-4 py-3 text-[12.5px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
