"use client";

/**
 * 对话面板：消息列表 + 输入区
 * 输入区支持：Enter 发送 / Shift+Enter 换行 / 语音输入（Web Speech API）/ 中断生成
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, Square } from "lucide-react";
import { useStore } from "@/lib/store";
import { SUGGESTIONS } from "@/lib/data/datasets";
import { Button } from "@/components/ui";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";

// Web Speech API 类型声明（TS DOM 库未包含）
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike extends Event {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function ChatPanel() {
  const { messages, isStreaming, send, stop, activeDatasetId, datasets, pushToast } = useStore();
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const active = datasets.find((d) => d.id === activeDatasetId);
  const suggestions = (activeDatasetId && SUGGESTIONS[activeDatasetId]) || [];

  // 自动滚动到底部
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 自适应高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  // 卸载时停止语音识别
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const handleSend = () => {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    void send(q);
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      pushToast("当前浏览器不支持语音识别，建议使用 Chrome / Edge");
      return;
    }
    rec.lang = "zh-CN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) setInput((prev) => (prev ? prev + transcript : transcript));
    };
    rec.onerror = () => {
      setListening(false);
      pushToast("语音识别失败，请检查麦克风权限");
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 消息列表 */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <EmptyState
              datasetName={active?.name ?? null}
              suggestions={suggestions}
              onPick={(q) => setInput(q)}
            />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </div>
      </div>

      {/* 输入区 */}
      <div className="border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
        <div className="mx-auto max-w-3xl">
          {suggestions.length > 0 && messages.length === 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div
            className={cn(
              "flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-soft transition-all",
              isStreaming ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder={
                active
                  ? `就《${active.name}》提问，例如「${suggestions[0] ?? "近30天趋势如何"}」`
                  : "请先在左侧选择数据集"
              }
              className="max-h-[140px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 scrollbar-thin"
            />
            <button
              onClick={toggleVoice}
              title={listening ? "停止语音输入" : "语音输入"}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                listening
                  ? "bg-red-50 text-red-600 pulse-ring"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              )}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            {isStreaming ? (
              <Button variant="danger" size="sm" onClick={stop} className="h-9 shrink-0">
                <Square className="h-3.5 w-3.5" />
                停止
              </Button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                title="发送（Enter）"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-slate-400">
            Enter 发送 · Shift+Enter 换行 · 生成过程可随时中断 · 数据仅在本地与本次请求中处理
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  datasetName,
  suggestions,
  onPick,
}: {
  datasetName: string | null;
  suggestions: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeUp">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-glow">
        <svg viewBox="0 0 64 64" className="h-10 w-10">
          <defs>
            <linearGradient id="empty-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6366f1" />
              <stop offset="1" stopColor="#4338ca" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#empty-g)" />
          <path d="M14 44 L26 30 L36 37 L50 20" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="20" r="5" fill="#fff" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900">你好，我是灵犀洞察</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {datasetName
          ? `当前已加载《${datasetName}》。用自然语言提问，我会自动完成查询、聚合、图表推荐与洞察生成。`
          : "在左侧选择或上传一个数据集，即可开始对话式分析。"}
      </p>
      {suggestions.length > 0 && (
        <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 hover:shadow-soft"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
