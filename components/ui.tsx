"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Button ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm disabled:hover:bg-brand-600",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
  outline: "border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        BUTTON_VARIANTS[variant],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---------- Card ----------

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-soft",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------- Badge ----------

type BadgeTone = "brand" | "green" | "amber" | "red" | "slate" | "violet";

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ---------- Logo ----------

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logo-g)" />
      <path
        d="M14 44 L26 30 L36 37 L50 20"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="20" r="5" fill="#ffffff" />
      <circle cx="26" cy="30" r="3.4" fill="#c7d2fe" />
      <circle cx="36" cy="37" r="3.4" fill="#c7d2fe" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-slate-900">
        灵犀<span className="text-brand-600">洞察</span>
      </span>
    </span>
  );
}

// ---------- Markdown 轻量渲染（报告 / 洞察文本） ----------

function inlineMd(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-${i}`}>{p}</React.Fragment>
    )
  );
}

export function MarkdownLite({ content }: { content: string }) {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 表格
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) {
        out.push(
          <div key={`t${k++}`} className="my-3 overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[380px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {rows[0].map((c, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-semibold text-slate-700">
                      {inlineMd(c, `th${k}-${ci}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((r, ri) => (
                  <tr key={ri} className="border-b border-slate-100 last:border-0">
                    {r.map((c, ci) => (
                      <td key={ci} className="px-3 py-2 text-slate-600">
                        {inlineMd(c, `td${k}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level <= 1
          ? "text-base font-bold text-slate-900 mt-4 mb-2"
          : level === 2
            ? "text-sm font-bold text-slate-900 mt-4 mb-1.5"
            : "text-sm font-semibold text-slate-800 mt-3 mb-1";
      out.push(
        <p key={`h${k++}`} className={cls}>
          {inlineMd(h[2], `h${k}`)}
        </p>
      );
      i++;
      continue;
    }

    // 列表
    if (/^[-·]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-·]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-·]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={`ul${k++}`} className="my-1.5 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              <span>{inlineMd(it, `li${k}-${ii}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\d+[.、]\s*/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.、]\s*/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.、]\s*/, ""));
        i++;
      }
      out.push(
        <ol key={`ol${k++}`} className="my-1.5 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                {ii + 1}
              </span>
              <span>{inlineMd(it, `oi${k}-${ii}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 引用
    if (line.trim().startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote
          key={`q${k++}`}
          className="my-2 border-l-2 border-brand-300 bg-brand-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600"
        >
          {inlineMd(quote.join(" "), `q${k}`)}
        </blockquote>
      );
      continue;
    }

    // 空行
    if (!line.trim()) {
      i++;
      continue;
    }

    // 段落
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("|") &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^[-·]\s+/.test(lines[i].trim()) &&
      !/^\d+[.、]\s*/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">")
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={`p${k++}`} className="my-1.5 text-sm leading-relaxed text-slate-700">
        {inlineMd(para.join(" "), `p${k}`)}
      </p>
    );
  }

  return <div className="space-y-0.5">{out}</div>;
}

// ---------- 打字动画指示 ----------

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
    </span>
  );
}
