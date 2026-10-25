"use client";

/**
 * 消息气泡：渲染一条 ChatMessage 的全部内容块
 * （文本 / 指标卡 / 图表卡 / 数据表 / 知识库引用 / 错误 / 报告）
 */

import { AlertTriangle, BarChart3, BookOpen, Bot, Sparkles, User } from "lucide-react";
import type { ChatMessage, ChartSpec, MetricItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Badge, Card, LogoMark, MarkdownLite } from "@/components/ui";
import { ChartRenderer } from "./Charts";
import { cn } from "@/lib/utils";

function MetricCard({ item }: { item: MetricItem }) {
  const trendColor =
    item.trend === "up"
      ? "text-red-600" // 中国市场惯例：涨红
      : item.trend === "down"
        ? "text-emerald-600" // 跌绿
        : "text-slate-500";
  const trendIcon = item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "—";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
      <div className="text-[11px] font-medium text-slate-500">{item.label}</div>
      <div className="mt-1 text-lg font-bold tracking-tight text-slate-900">{item.value}</div>
      {item.delta && (
        <div className={cn("mt-0.5 text-xs font-semibold", trendColor)}>
          {trendIcon} {item.delta}
        </div>
      )}
      {item.hint && <div className="mt-0.5 text-[11px] text-slate-400">{item.hint}</div>}
    </div>
  );
}

function ChartCard({ spec }: { spec: ChartSpec }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold text-slate-800">{spec.title}</span>
        </div>
        <Badge tone="brand">
          <Sparkles className="h-3 w-3" />
          {spec.forecast ? "AI 趋势预测" : "AI 推荐图表"}
        </Badge>
      </div>
      <div className="px-3 pb-3 pt-2">
        <ChartRenderer spec={spec} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
        {spec.series.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"][i % 6] }}
            />
            {s.name}
            {s.dashed ? "（虚线）" : ""}
          </span>
        ))}
        {spec.forecast && <span className="text-amber-600">预测部分为演示性线性外推，仅供参考</span>}
      </div>
    </Card>
  );
}

function DataTable({ spec }: { spec: Extract<ChatMessage["blocks"][number], { kind: "table" }>["spec"] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="max-h-64 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {spec.columns.map((c, i) => (
                <th key={i} className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-600">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((r, ri) => (
              <tr key={ri} className="hover:bg-slate-50/70">
                {r.map((cell, ci) => (
                  <td key={ci} className="border-b border-slate-100 px-3 py-1.5 text-slate-600 last:font-medium">
                    {typeof cell === "number" ? cell.toLocaleString("zh-CN") : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CitationList({ items }: { items: Extract<ChatMessage["blocks"][number], { kind: "citations" }>["items"] }) {
  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <BookOpen className="h-4 w-4 text-brand-500" />
        知识库引用（{items.length}）
      </div>
      <div className="space-y-2.5">
        {items.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-brand-700">
                [{c.id}] 《{c.source}》
              </span>
              <span className="text-slate-400">相关度 {c.score.toFixed(2)}</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">「{c.snippet}」</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-fadeUp">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
          {message.blocks.map((b, i) => (
            <p key={i}>{(b as { content: string }).content}</p>
          ))}
        </div>
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
          <User className="h-4 w-4 text-slate-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fadeUp">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-soft ring-1 ring-slate-200">
        <LogoMark className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {message.blocks.length === 0 && message.streaming && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Bot className="h-4 w-4" />
            正在思考
          </div>
        )}
        {message.blocks.map((block, i) => {
          const isLast = i === message.blocks.length - 1;
          switch (block.kind) {
            case "text":
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-soft ring-1 ring-slate-200/70",
                    message.streaming && isLast && "stream-caret"
                  )}
                >
                  <MarkdownLite content={block.content} />
                </div>
              );
            case "metrics":
              return (
                <div key={i} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {block.items.map((m, mi) => (
                    <MetricCard key={mi} item={m} />
                  ))}
                </div>
              );
            case "chart":
              return <ChartCard key={i} spec={block.spec} />;
            case "table":
              return <DataTable key={i} spec={block.spec} />;
            case "citations":
              return <CitationList key={i} items={block.items} />;
            case "report":
              return (
                <Card key={i} className="p-4">
                  <MarkdownLite content={block.content} />
                </Card>
              );
            case "error":
              return (
                <div
                  key={i}
                  className="rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-relaxed">{block.message}</span>
                  </div>
                  <button
                    onClick={() => void useStore.getState().retry()}
                    className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm ring-1 ring-red-200 transition-colors hover:bg-red-100"
                  >
                    重试
                  </button>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
