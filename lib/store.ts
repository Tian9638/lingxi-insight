/**
 * 全局状态层（Zustand）
 * 负责：数据集 / 知识库 / 会话消息 / Agent 追踪 / 流式消费
 */

import { create } from "zustand";
import type {
  AgentEvent,
  ChatMessage,
  Dataset,
  KnowledgeDoc,
  MsgBlock,
  TraceState,
  TraceStep,
} from "./types";
import { getSampleDatasets } from "./data/datasets";
import { chunkText } from "./ai/rag";
import { rid } from "./utils";

export type ModelTier = "pro" | "lite";

interface Toast {
  id: number;
  text: string;
}

interface Store {
  // ---- 数据 ----
  datasets: Dataset[];
  activeDatasetId: string | null;
  docs: KnowledgeDoc[];

  // ---- 设置 ----
  ragOn: boolean;
  deep: boolean;
  model: ModelTier;
  /** 回答引擎：auto=有Key用真实模型 / llm=强制真实模型 / local=强制本地演示引擎 */
  engine: "auto" | "local" | "llm";
  /** 最近一次回答的实际通道（来自 meta 事件） */
  lastChannel: { isLlm: boolean; model: string } | null;

  // ---- 会话 ----
  messages: ChatMessage[];
  trace: TraceState;
  isStreaming: boolean;
  /** 最近一次成功发送的问题（供失败重试使用） */
  lastQuestion: string;
  report: { open: boolean; md: string; streaming: boolean };
  toast: Toast | null;

  // ---- Actions ----
  setActiveDataset: (id: string) => void;
  addDataset: (ds: Dataset) => void;
  removeDataset: (id: string) => void;
  addDoc: (name: string, content: string) => void;
  removeDoc: (id: string) => void;
  setRagOn: (v: boolean) => void;
  setDeep: (v: boolean) => void;
  setModel: (v: ModelTier) => void;
  setEngine: (v: "auto" | "local" | "llm") => void;
  clearMessages: () => void;
  pushToast: (text: string) => void;
  dismissToast: () => void;
  send: (question: string) => Promise<void>;
  stop: () => void;
  /** 重试最近一次失败的问题 */
  retry: () => Promise<void>;
  openReport: () => void;
  closeReport: () => void;
  generateReport: () => Promise<void>;
}

const toolStartTimes = new Map<string, number>();
let abortController: AbortController | null = null;

const emptyTrace = (): TraceState => ({ steps: [], running: false });

function toHistoryTurn(m: ChatMessage) {
  const text = m.blocks
    .filter((b) => b.kind === "text")
    .map((b) => (b as { content: string }).content)
    .join("\n");
  return { role: m.role, content: text.slice(0, 600) };
}

export const useStore = create<Store>((setState, getState) => ({
  datasets: getSampleDatasets(),
  activeDatasetId: getSampleDatasets()[0]?.id ?? null,
  docs: [],
  ragOn: false,
  deep: false,
  model: "pro",
  engine: "auto",
  lastChannel: null,
  messages: [],
  trace: emptyTrace(),
  isStreaming: false,
  lastQuestion: "",
  report: { open: false, md: "", streaming: false },
  toast: null,

  setActiveDataset: (id) => setState({ activeDatasetId: id }),

  addDataset: (ds) =>
    setState((s) => ({ datasets: [...s.datasets, ds], activeDatasetId: ds.id })),

  removeDataset: (id) =>
    setState((s) => {
      const datasets = s.datasets.filter((d) => d.id !== id);
      return {
        datasets,
        activeDatasetId: s.activeDatasetId === id ? (datasets[0]?.id ?? null) : s.activeDatasetId,
      };
    }),

  addDoc: (name, content) =>
    setState((s) => ({
      docs: [
        ...s.docs,
        {
          id: rid("doc-"),
          name: name.trim() || "未命名文档",
          content,
          chunkCount: chunkText(content).length,
        },
      ],
      ragOn: true,
    })),

  removeDoc: (id) =>
    setState((s) => ({
      docs: s.docs.filter((d) => d.id !== id),
      ragOn: s.docs.length > 1 ? s.ragOn : false,
    })),

  setRagOn: (v) => setState({ ragOn: v }),
  setDeep: (v) => setState({ deep: v }),
  setModel: (v) => setState({ model: v }),
  setEngine: (v) => setState({ engine: v }),
  clearMessages: () => setState({ messages: [], trace: emptyTrace() }),

  pushToast: (text) => {
    const id = Date.now();
    setState({ toast: { id, text } });
    setTimeout(() => {
      if (getState().toast?.id === id) setState({ toast: null });
    }, 2600);
  },
  dismissToast: () => setState({ toast: null }),

  // ---------- 流式对话 ----------
  send: async (question) => {
    const state = getState();
    const q = question.trim();
    if (!q || state.isStreaming) return;
    setState({ lastQuestion: q });

    const ds = state.datasets.find((d) => d.id === state.activeDatasetId);
    const assistantId = rid("msg-");
    const history = [...state.messages.slice(-6).map(toHistoryTurn), { role: "user" as const, content: q }];

    setState((s) => ({
      messages: [
        ...s.messages,
        {
          id: rid("msg-"),
          role: "user",
          blocks: [{ kind: "text", content: q }],
          streaming: false,
          createdAt: Date.now(),
        },
        { id: assistantId, role: "assistant", blocks: [], streaming: true, createdAt: Date.now() },
      ],
      trace: { steps: [], running: true },
      isStreaming: true,
    }));

    const payload = {
      question: q,
      dataset: ds
        ? {
            id: ds.id,
            name: ds.name,
            columns: ds.columns,
            rows: ds.rows.slice(0, 3000),
            source: ds.source,
          }
        : undefined,
      docs: state.docs.map((d) => ({ id: d.id, name: d.name, content: d.content })),
      ragOn: state.ragOn,
      deep: state.deep,
      model: state.model,
      channel: state.engine,
      history,
    };

    abortController = new AbortController();
    let stopped = false;

    const patchAssistant = (fn: (blocks: MsgBlock[]) => MsgBlock[]) =>
      setState((s) => ({
        messages: s.messages.map((m) => (m.id === assistantId ? { ...m, blocks: fn(m.blocks) } : m)),
      }));

    const appendBlock = (block: MsgBlock) =>
      patchAssistant((blocks) => [...blocks, block]);

    const appendText = (delta: string) =>
      patchAssistant((blocks) => {
        const last = blocks[blocks.length - 1];
        if (last && last.kind === "text") {
          return [...blocks.slice(0, -1), { kind: "text", content: last.content + delta }];
        }
        return [...blocks, { kind: "text", content: delta }];
      });

    const patchTrace = (fn: (trace: TraceState) => TraceState) =>
      setState((s) => ({ trace: fn(s.trace) }));

    const applyEvent = (ev: AgentEvent) => {
      switch (ev.type) {
        case "meta":
          // 记录本次回答的实际通道，供顶栏徽标实时显示
          setState({
            lastChannel: { isLlm: ev.channel === "llm", model: ev.model },
          });
          patchTrace((t) => ({
            ...t,
            steps: [...t.steps, { id: rid("tr-"), kind: "meta", title: `模型就绪：${ev.model}`, status: "done" }],
          }));
          break;
        case "plan":
          patchTrace((t) => ({
            ...t,
            steps: [...t.steps, { id: rid("tr-"), kind: "plan", title: "分析规划", steps: ev.steps, status: "done" }],
          }));
          break;
        case "tool_call":
          toolStartTimes.set(ev.id, Date.now());
          patchTrace((t) => ({
            ...t,
            steps: [
              ...t.steps,
              {
                id: ev.id,
                kind: "tool",
                title: ev.label,
                args: ev.args,
                status: "running",
              },
            ],
          }));
          break;
        case "tool_result": {
          const ms = Date.now() - (toolStartTimes.get(ev.id) ?? Date.now());
          toolStartTimes.delete(ev.id);
          patchTrace((t) => ({
            ...t,
            steps: t.steps.map((s) =>
              s.id === ev.id
                ? { ...s, status: ev.ok ? "done" : "error", summary: ev.summary, ms }
                : s
            ),
          }));
          if (ev.metrics?.length) appendBlock({ kind: "metrics", items: ev.metrics });
          if (ev.chart) appendBlock({ kind: "chart", spec: ev.chart });
          if (ev.table) appendBlock({ kind: "table", spec: ev.table });
          break;
        }
        case "text":
          appendText(ev.delta);
          break;
        case "citations":
          appendBlock({ kind: "citations", items: ev.items });
          break;
        case "usage":
          patchTrace((t) => ({
            ...t,
            usage: {
              promptTokens: ev.promptTokens,
              completionTokens: ev.completionTokens,
              toolCalls: ev.toolCalls,
              latencyMs: ev.latencyMs,
            },
          }));
          break;
        case "error":
          appendBlock({ kind: "error", message: ev.message });
          break;
        case "done":
          break;
      }
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(`接口返回 ${res.status}：${detail.slice(0, 120)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            applyEvent(JSON.parse(raw) as AgentEvent);
          } catch {
            /* 忽略损坏分片 */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        stopped = true;
      } else if (err instanceof TypeError) {
        // fetch 在网络层失败：通常是服务未启动或跨域
        appendBlock({
          kind: "error",
          message:
            "无法连接到服务器（Failed to fetch）。请确认应用服务正在运行：在项目目录执行 npm run dev（或 npm start），待终端出现 Ready 后点击下方「重试」。",
        });
      } else {
        appendBlock({ kind: "error", message: (err as Error).message || "网络异常" });
      }
    } finally {
      setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                streaming: false,
                blocks:
                  stopped && m.blocks.length === 0
                    ? [{ kind: "text", content: "（已停止生成）" }]
                    : m.blocks,
              }
            : m
        ),
        isStreaming: false,
        trace: { ...getState().trace, running: false },
      }));
      abortController = null;
    }
  },

  stop: () => {
    abortController?.abort();
  },

  // ---------- 失败重试 ----------
  retry: async () => {
    const s = getState();
    if (s.isStreaming) return;
    // 定位最后一条用户消息
    let lastUserIndex = -1;
    for (let i = s.messages.length - 1; i >= 0; i--) {
      if (s.messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex < 0) {
      getState().pushToast("没有可重试的问题");
      return;
    }
    const q = (s.messages[lastUserIndex].blocks[0] as { content: string }).content;
    // 若该问题之后只有一条失败的回答，移除这一对，避免历史重复
    const tail = s.messages.slice(lastUserIndex);
    const cleaned =
      tail.length === 2 && tail[1].role === "assistant"
        ? s.messages.slice(0, lastUserIndex)
        : s.messages;
    setState({ messages: cleaned });
    await getState().send(q);
  },

  // ---------- 洞察报告 ----------
  openReport: () => setState((s) => ({ report: { ...s.report, open: true } })),
  closeReport: () => setState((s) => ({ report: { ...s.report, open: false } })),

  generateReport: async () => {
    const state = getState();
    const ds = state.datasets.find((d) => d.id === state.activeDatasetId);
    if (!ds) {
      getState().pushToast("请先选择或上传一个数据集");
      return;
    }
    const questions = state.messages
      .filter((m) => m.role === "user")
      .map((m) => (m.blocks[0] as { content: string }).content);

    setState((s) => ({ report: { open: true, md: "", streaming: true } }));

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset: {
            id: ds.id,
            name: ds.name,
            columns: ds.columns,
            rows: ds.rows.slice(0, 3000),
            source: ds.source,
          },
          questions,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`接口返回 ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let md = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            md += JSON.parse(raw) as string;
            setState((s) => ({ report: { ...s.report, md } }));
          } catch {
            /* 忽略 */
          }
        }
      }
      setState((s) => ({ report: { ...s.report, streaming: false } }));
      getState().pushToast("报告已生成，可下载 Markdown 文件");
    } catch (err) {
      setState((s) => ({ report: { ...s.report, streaming: false } }));
      getState().pushToast(`报告生成失败：${(err as Error).message}`);
    }
  },
}));
