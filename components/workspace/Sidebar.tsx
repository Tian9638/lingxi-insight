"use client";

/**
 * 左侧边栏：数据源管理 / 知识库（RAG）/ 引擎设置
 */

import { useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { parseCsvFile } from "@/lib/data/csv";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function Sidebar({
  channelInfo = null,
}: {
  channelInfo?: { isLlm: boolean; model: string | null } | null;
}) {
  const {
    datasets,
    activeDatasetId,
    setActiveDataset,
    removeDataset,
    addDataset,
    pushToast,
    docs,
    addDoc,
    removeDoc,
    ragOn,
    setRagOn,
    deep,
    setDeep,
    model,
    setModel,
    engine,
    setEngine,
    clearMessages,
  } = useStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [showDocForm, setShowDocForm] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<{ total: number; hits: { docName: string; score: number; preview: string }[] } | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ds = await parseCsvFile(file);
      addDataset(ds);
      pushToast(`已加载《${ds.name}》：${ds.rows.length} 行 × ${ds.columns.length} 列`);
    } catch (err) {
      pushToast((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleAddDoc = () => {
    if (!docContent.trim()) {
      pushToast("请输入文档内容");
      return;
    }
    addDoc(docName, docContent.trim());
    setDocName("");
    setDocContent("");
    setShowDocForm(false);
    pushToast("文档已加入知识库并完成切片索引");
  };

  const handleTest = async () => {
    if (!testQuery.trim() || docs.length === 0) return;
    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: testQuery, docs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "检索失败");
      setTestResult(data);
    } catch (err) {
      pushToast((err as Error).message);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4">
        {/* ---------- 数据源 ---------- */}
        <section className="mb-6">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Database className="h-3.5 w-3.5" />
              数据源
            </h3>
            <Button
              variant="ghost"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
              className="h-7 px-2 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              上传 CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
          </div>
          <div className="space-y-2">
            {datasets.map((ds) => {
              const active = ds.id === activeDatasetId;
              return (
                <div
                  key={ds.id}
                  onClick={() => setActiveDataset(ds.id)}
                  className={cn(
                    "group cursor-pointer rounded-xl border p-3 transition-all",
                    active
                      ? "border-brand-300 bg-brand-50/60 ring-1 ring-brand-200"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-800">{ds.name}</span>
                        {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {ds.rows.length} 行 · {ds.columns.length} 列 ·{" "}
                        {ds.source === "sample" ? "内置" : "上传"}
                      </div>
                    </div>
                    {ds.source === "upload" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDataset(ds.id);
                        }}
                        className="hidden h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 group-hover:flex"
                        title="移除数据集"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------- 知识库 ---------- */}
        <section className="mb-6">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <BookOpen className="h-3.5 w-3.5" />
              知识库（RAG）
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDocForm((v) => !v)}
              className="h-7 px-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              添加
            </Button>
          </div>

          {showDocForm && (
            <div className="mb-2.5 space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-2.5">
              <input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="文档名称，如：竞赛章程"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-300"
              />
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="粘贴文档内容（.txt / .md 文本）…"
                rows={4}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-300 scrollbar-thin"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDocForm(false)}>
                  取消
                </Button>
                <Button size="sm" onClick={handleAddDoc}>
                  入库
                </Button>
              </div>
            </div>
          )}

          {docs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] leading-relaxed text-slate-400">
              添加文档后，问答时将按 TF-IDF 检索并给出引用
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-500">问答时检索知识库</span>
                <button
                  onClick={() => setRagOn(!ragOn)}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    ragOn ? "bg-brand-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                      ragOn ? "left-[18px]" : "left-0.5"
                    )}
                  />
                </button>
              </div>
              <div className="space-y-1.5">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="group flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{d.name}</span>
                    <Badge tone="slate">{d.chunkCount} 片</Badge>
                    <button
                      onClick={() => removeDoc(d.id)}
                      className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-red-500 group-hover:flex"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleTest()}
                  placeholder="测试检索…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-brand-300"
                />
                <Button variant="secondary" size="sm" onClick={handleTest} className="h-8 px-2">
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
              {testResult && (
                <div className="mt-2 space-y-1.5">
                  {testResult.hits.length === 0 && (
                    <p className="text-[11px] text-slate-400">未命中任何片段</p>
                  )}
                  {testResult.hits.map((h, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-slate-600">《{h.docName}》</span>
                        <span className="text-brand-600">{h.score.toFixed(2)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                        {h.preview}…
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ---------- 引擎设置 ---------- */}
      <section className="border-t border-slate-200 p-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          引擎设置
        </h3>

        {/* 回答引擎：本地演示引擎 ↔ 真实大模型 */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">回答引擎</span>
            {channelInfo?.isLlm ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                已配置 {channelInfo.model}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-amber-600">未配置 API Key</span>
            )}
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {[
              { key: "auto" as const, label: "自动" },
              { key: "llm" as const, label: "真实模型" },
              { key: "local" as const, label: "本地演示" },
            ].map((e) => (
              <button
                key={e.key}
                onClick={() => setEngine(e.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                  engine === e.key
                    ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
            {engine === "auto" &&
              (channelInfo?.isLlm
                ? `已配置 Key：默认使用 ${channelInfo.model} 回答`
                : "未配置 Key：当前使用本地演示引擎（配置方法见 docs/模型接入指南.md）")}
            {engine === "llm" &&
              (channelInfo?.isLlm
                ? `强制使用 ${channelInfo.model} 回答`
                : "未配置 Key：将提示原因并回退本地演示引擎")}
            {engine === "local" && "强制本地演示引擎：不调用任何外部 API，完全离线"}
          </p>
        </div>

        <div className="mb-2.5 flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {([
            { key: "pro" as const, label: "灵犀-Pro", desc: "深度推理" },
            { key: "lite" as const, label: "灵犀-Lite", desc: "快速响应" },
          ]).map((m) => (
            <button
              key={m.key}
              onClick={() => setModel(m.key)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                model === m.key
                  ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {m.label}
              <span className="ml-1 text-[10px] text-slate-400">{m.desc}</span>
            </button>
          ))}
        </div>
        {channelInfo?.isLlm && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
            已接入真实大模型：工具由 LLM 自主选择与编排，解读由模型实时生成；Pro / Lite 档位仅在本地演示引擎下生效。
          </div>
        )}
        <label className="mb-3 flex cursor-pointer items-center justify-between rounded-lg px-1">
          <span className="text-xs text-slate-600">深度思考模式</span>
          <button
            onClick={() => setDeep(!deep)}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              deep ? "bg-brand-600" : "bg-slate-300"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                deep ? "left-[18px]" : "left-0.5"
              )}
            />
          </button>
        </label>
        <Button variant="secondary" size="sm" className="w-full" onClick={clearMessages}>
          开启新对话
        </Button>
      </section>
    </aside>
  );
}
