/**
 * 灵犀洞察 · 全局共享类型定义
 * 该文件是前后端之间的「契约」：AI 引擎产出 AgentEvent 流，
 * 前端消费并渲染为对话 / 图表 / 指标 / 引用 / 追踪面板。
 */

// ---------- 数据层 ----------

export type ColumnType = "number" | "date" | "string";

export interface Column {
  name: string;
  type: ColumnType;
}

export type CellValue = string | number;

/** 传输到服务端的数据集载荷 */
export interface DatasetPayload {
  id: string;
  name: string;
  columns: Column[];
  rows: Record<string, CellValue>[];
  source: "sample" | "upload";
}

/** 前端完整数据集（含创建时间等元信息） */
export interface Dataset extends DatasetPayload {
  createdAt: number;
}

/** 知识库文档（客户端持有，请求时随载荷发送） */
export interface KnowledgeDoc {
  id: string;
  name: string;
  content: string;
  chunkCount: number;
}

// ---------- 图表 ----------

export type ChartType = "line" | "bar" | "hbar" | "donut" | "scatter";

export interface ChartPoint {
  /** X 轴标签（时间或类别） */
  x: string;
  /** Y 轴数值 */
  y: number;
  /** 数值型 X（散点图使用） */
  nx?: number;
  /** 异常点标注 */
  flag?: "anomaly";
}

export interface ChartSeries {
  name: string;
  points: ChartPoint[];
  /** 预测序列（虚线渲染） */
  dashed?: boolean;
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  xLabel?: string;
  yLabel?: string;
  series: ChartSeries[];
  /** 是否包含演示性预测 */
  forecast?: boolean;
}

// ---------- 指标卡 ----------

export interface MetricItem {
  label: string;
  value: string;
  /** 变化描述，如 "+12.4%" */
  delta?: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
}

// ---------- 表格 ----------

export interface TableSpec {
  columns: string[];
  rows: CellValue[][];
}

// ---------- 引用 ----------

export interface Citation {
  id: number;
  source: string;
  snippet: string;
  score: number;
}

// ---------- Agent 事件协议（SSE） ----------

export type AgentEvent =
  | { type: "meta"; model: string; requestId: string; deep: boolean; channel: "llm" | "local" }
  | { type: "plan"; steps: string[] }
  | {
      type: "tool_call";
      id: string;
      name: string;
      label: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      id: string;
      ok: boolean;
      summary: string;
      chart?: ChartSpec;
      metrics?: MetricItem[];
      table?: TableSpec;
    }
  | { type: "text"; delta: string }
  | { type: "citations"; items: Citation[] }
  | {
      type: "usage";
      promptTokens: number;
      completionTokens: number;
      toolCalls: number;
      latencyMs: number;
    }
  | { type: "done"; ok: boolean }
  | { type: "error"; message: string };

// ---------- 引擎输入 ----------

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface KnowledgeDocPayload {
  id: string;
  name: string;
  content: string;
}

export interface AgentInput {
  question: string;
  dataset?: DatasetPayload;
  docs?: KnowledgeDocPayload[];
  ragOn: boolean;
  deep: boolean;
  model: "pro" | "lite";
  /**
   * 回答引擎选择：
   *  - auto（默认）：服务端配置了 Key 则用真实模型，否则用本地演示引擎
   *  - llm：强制真实模型（未配置 Key 时提示并回退本地引擎）
   *  - local：强制本地演示引擎
   */
  channel?: "auto" | "local" | "llm";
  history: HistoryTurn[];
}

// ---------- 前端消息模型 ----------

export type MsgBlock =
  | { kind: "text"; content: string }
  | { kind: "metrics"; items: MetricItem[] }
  | { kind: "chart"; spec: ChartSpec }
  | { kind: "table"; spec: TableSpec }
  | { kind: "citations"; items: Citation[] }
  | { kind: "report"; content: string }
  | { kind: "error"; message: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  blocks: MsgBlock[];
  streaming: boolean;
  createdAt: number;
}

// ---------- Agent 追踪面板 ----------

export type TraceStepStatus = "running" | "done" | "error";

export interface TraceStep {
  id: string;
  kind: "meta" | "plan" | "tool" | "text";
  title: string;
  status: TraceStepStatus;
  steps?: string[];
  args?: Record<string, unknown>;
  summary?: string;
  ms?: number;
}

export interface TraceState {
  steps: TraceStep[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    toolCalls: number;
    latencyMs: number;
  };
  running: boolean;
}
