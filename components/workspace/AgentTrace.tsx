"use client";

/**
 * 右侧 Agent 追踪面板：实时展示 ReAct 循环
 * （规划 -> 工具调用 -> 观察 -> 生成）与用量统计
 */

import { useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { TraceStep } from "@/lib/types";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

function ToolStep({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false);
  const running = step.status === "running";
  return (
    <div className="rounded-lg border border-slate-100 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
        ) : step.status === "error" ? (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
          {step.title}
        </span>
        {step.ms != null && (
          <span className="shrink-0 text-[10px] text-slate-400">{step.ms}ms</span>
        )}
        {step.args && Object.keys(step.args).length > 0 &&
          (open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
          ))}
      </button>
      {open && step.args && (
        <div className="border-t border-slate-100 px-2.5 py-2">
          {step.summary && (
            <p className="mb-1.5 text-[11px] leading-relaxed text-slate-500">{step.summary}</p>
          )}
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-200 scrollbar-thin">
            {JSON.stringify(step.args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function AgentTrace() {
  const { trace } = useStore();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Brain className="h-4 w-4 text-brand-500" />
          Agent 追踪
        </h3>
        {trace.running && (
          <Badge tone="brand">
            <Loader2 className="h-3 w-3 animate-spin" />
            运行中
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-thin p-3">
        {trace.steps.length === 0 && !trace.running && (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <Wrench className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs leading-relaxed text-slate-400">
              发送一个问题后，这里会实时展示
              <br />
              AI 的规划、工具调用与执行结果
            </p>
          </div>
        )}

        {trace.steps.map((step) => (
          <div key={step.id}>
            {step.kind === "plan" ? (
              <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                  <Brain className="h-3.5 w-3.5" />
                  分析规划
                </div>
                <ol className="space-y-1">
                  {step.steps?.map((s, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-slate-600">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ) : step.kind === "meta" ? (
              <div className="flex items-center gap-1.5 px-1 py-1 text-[11px] text-slate-400">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {step.title}
              </div>
            ) : (
              <ToolStep step={step} />
            )}
          </div>
        ))}

        {trace.running && (
          <div className="flex items-center gap-2 px-1 py-1 text-[11px] text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            等待下一步…
          </div>
        )}
      </div>

      {trace.usage && (
        <div className="border-t border-slate-200 bg-slate-50/80 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Clock className="h-3 w-3" />
            本次运行统计
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "总耗时", value: `${(trace.usage.latencyMs / 1000).toFixed(2)}s` },
              { label: "工具调用", value: `${trace.usage.toolCalls} 次` },
              { label: "输入 tokens", value: trace.usage.promptTokens.toLocaleString("zh-CN") },
              { label: "输出 tokens", value: trace.usage.completionTokens.toLocaleString("zh-CN") },
            ].map((s) => (
              <div key={s.label} className="rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200/70">
                <div className="text-[10px] text-slate-400">{s.label}</div>
                <div className="text-xs font-semibold text-slate-700">{s.value}</div>
              </div>
            ))}
          </div>
          <p className={cn("mt-2 text-[10px] leading-relaxed text-slate-400")}>
            tokens 为按字符数的估算值；接入真实模型后由 API 返回精确用量。
          </p>
        </div>
      )}
    </div>
  );
}
