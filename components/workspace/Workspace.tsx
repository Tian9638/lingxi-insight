"use client";

/**
 * 工作台编排：顶栏 + 三栏布局（数据源 / 对话 / Agent 追踪与数据预览）
 * 响应式：小屏侧栏与右栏收纳为抽屉 / 隐藏
 */

import { useState } from "react";
import { useEffect } from "react";
import {
  Brain,
  Database,
  Download,
  FileText,
  Loader2,
  Menu,
  Table2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Button, Card, Logo, MarkdownLite } from "@/components/ui";
import { Sidebar } from "./Sidebar";
import { ChatPanel } from "./ChatPanel";
import { AgentTrace } from "./AgentTrace";
import { DataPreview } from "./DataPreview";
import { cn } from "@/lib/utils";

type RightTab = "trace" | "data";

export function Workspace() {
  const {
    datasets,
    activeDatasetId,
    report,
    openReport,
    closeReport,
    generateReport,
    toast,
    dismissToast,
    isStreaming,
    model,
    lastChannel,
  } = useStore();

  const [tab, setTab] = useState<RightTab>("trace");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channelInfo, setChannelInfo] = useState<{
    isLlm: boolean;
    model: string | null;
  } | null>(null);
  const active = datasets.find((d) => d.id === activeDatasetId);

  // 拉取服务端通道配置（是否配置了真实模型 Key）
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setChannelInfo({ isLlm: !!d.isLlm, model: d.model ?? null }))
      .catch(() => setChannelInfo({ isLlm: false, model: null }));
  }, []);

  // 顶栏徽标优先显示「最近一次回答的实际通道」，首答前显示服务端配置
  const badge = lastChannel ?? (channelInfo ? { isLlm: channelInfo.isLlm, model: channelInfo.model } : null);

  const downloadReport = () => {
    const blob = new Blob([report.md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active?.name ?? "数据集"}-洞察报告.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100/70">
      {/* ---------- 顶栏 ---------- */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
          title="打开数据源面板"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
        <span className="hidden text-xs text-slate-300 sm:inline">|</span>
        <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 sm:inline-flex">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          {active ? active.name : "未选择数据集"}
        </span>

        <div className="flex-1" />

        {/* 实际生效的 AI 通道指示（优先显示最近一次回答的通道） */}
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
            badge?.isLlm
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
              : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
          )}
          title={
            badge?.isLlm
              ? `最近一次回答由真实大模型 ${badge.model} 生成`
              : "最近一次回答由内置本地演示引擎生成（未配置 API Key 或选择了本地演示）"
          }
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              badge?.isLlm ? "bg-emerald-500 pulse-ring" : "bg-slate-400"
            )}
          />
          {badge?.isLlm ? `${badge.model} · 真实模型` : "本地演示引擎"}
        </span>
        <Badge tone="violet" className="hidden lg:inline-flex">
          <Brain className="h-3 w-3" />
          {model === "pro" ? "灵犀-Pro" : "灵犀-Lite"}
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          loading={report.streaming}
          onClick={() => (report.md && !report.streaming ? openReport() : void generateReport())}
          disabled={!active}
        >
          <FileText className="h-4 w-4" />
          生成洞察报告
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- 左侧栏（桌面） ---------- */}
        <div className="hidden w-72 shrink-0 lg:block">
          <Sidebar channelInfo={channelInfo} />
        </div>

        {/* ---------- 左侧栏（移动端抽屉） ---------- */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl animate-fadeUp">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute right-2 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
              <Sidebar channelInfo={channelInfo} />
            </div>
          </div>
        )}

        {/* ---------- 中间对话区 ---------- */}
        <main className="min-w-0 flex-1">
          <ChatPanel />
        </main>

        {/* ---------- 右侧面板 ---------- */}
        <div className="hidden w-80 shrink-0 border-l border-slate-200 bg-white xl:block">
          <div className="flex border-b border-slate-200">
            {([
              { key: "trace" as const, label: "Agent 追踪", icon: Brain },
              { key: "data" as const, label: "数据预览", icon: Table2 },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                  tab === t.key
                    ? "border-b-2 border-brand-600 text-brand-700"
                    : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          {tab === "trace" ? <AgentTrace /> : <DataPreview />}
        </div>
      </div>

      {/* ---------- 报告弹窗 ---------- */}
      {report.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <Card className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden animate-fadeUp">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <FileText className="h-4 w-4 text-brand-500" />
                数据洞察报告
              </h2>
              <div className="flex items-center gap-2">
                {report.streaming && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    生成中
                  </span>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={downloadReport}
                  disabled={report.streaming || !report.md}
                >
                  <Download className="h-3.5 w-3.5" />
                  下载 Markdown
                </Button>
                <button
                  onClick={closeReport}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
              {report.md ? (
                <MarkdownLite content={report.md} />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在汇总多维指标…
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ---------- Toast ---------- */}
      {toast && (
        <div
          onClick={dismissToast}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 cursor-pointer animate-fadeUp rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-2xl"
        >
          {toast.text}
        </div>
      )}

      {/* 流式进行中的全局提示（小屏可见） */}
      {isStreaming && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-[11px] text-white shadow-lg sm:hidden">
          AI 正在生成…
        </div>
      )}
    </div>
  );
}
