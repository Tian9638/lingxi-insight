/**
 * AI 工具注册表
 * 同一套工具同时服务于：
 *  1. 本地演示引擎（直接调用 executeTool）
 *  2. 真实大模型通道（以 OpenAI Function Calling 协议暴露 TOOL_DEFS）
 * 这保证了两条通道产出完全一致的结构化结果。
 */

import type {
  ChartSpec,
  DatasetPayload,
  MetricItem,
  TableSpec,
} from "../types";
import {
  correlationData,
  datasetOverview,
  detectAnomalies,
  forecastSeries,
  getCategoryColumns,
  getDateColumn,
  getNumericColumns,
  queryData,
  type Agg,
  type Granularity,
  type QuerySpec,
  type QueryResult,
} from "./dataops";
import { ragAnswer } from "./rag";
import { fmtInt } from "../utils";

export interface ToolContext {
  dataset?: DatasetPayload;
  docs?: { id: string; name: string; content: string }[];
}

export interface ToolOutcome {
  summary: string;
  data?: unknown;
  chart?: ChartSpec;
  metrics?: MetricItem[];
  table?: TableSpec;
}

/** OpenAI Function Calling 协议的工具定义（真实模型通道使用） */
export const TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "query_data",
      description:
        "对数据集执行过滤、分组与聚合查询，返回序列、表格与统计指标。适用于趋势、占比、排名、对比类问题。",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", description: "指标列名（数值列），如 销售额" },
          dim: { type: "string", description: "X 轴维度（日期列或类别列），如 日期 / 品类" },
          agg: { type: "string", enum: ["sum", "avg", "max", "min", "count"] },
          granularity: { type: "string", enum: ["day", "week", "month", "none"] },
          lastDays: { type: "number", description: "最近 N 天，如 30" },
          filters: {
            type: "array",
            description: "维度值过滤",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                values: { type: "array", items: { type: "string" } },
              },
            },
          },
          limit: { type: "number", description: "Top N，用于排名/占比" },
          intent: {
            type: "string",
            enum: ["trend", "compare", "distribution", "ranking", "report"],
          },
        },
        required: ["metric", "dim"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_overview",
      description: "获取数据集概览：行列数、时间范围、各维度取值数、数值列统计。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "detect_anomaly",
      description: "对指标的时间序列做 Z-Score 异常检测，返回异常点列表。",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string" },
          lastDays: { type: "number" },
        },
        required: ["metric"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "forecast",
      description: "对指标的时间序列做线性趋势预测（演示性），返回未来若干期的预测值。",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string" },
          lastDays: { type: "number" },
          steps: { type: "number", description: "预测期数，默认 7" },
        },
        required: ["metric"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_knowledge",
      description: "在用户上传的知识库文档中检索与问题最相关的片段（TF-IDF），返回带引用的答案。",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
];

export const TOOL_LABELS: Record<string, string> = {
  query_data: "数据查询与聚合",
  get_overview: "数据集概览",
  detect_anomaly: "异常检测（Z-Score）",
  forecast: "线性趋势预测",
  search_knowledge: "知识库检索（TF-IDF）",
  analyze_correlation: "相关性分析（Pearson）",
  recommend_chart: "智能图表推荐",
};

/** 将（可能来自 LLM 的）宽松参数归一化为 QuerySpec */
export function specFromArgs(args: Record<string, unknown>, ds: DatasetPayload): QuerySpec {
  const dateCol = getDateColumn(ds);
  const numCols = getNumericColumns(ds);
  const strCols = getCategoryColumns(ds);
  const a = args as Record<string, any>;
  const metric = numCols.includes(a.metric) ? a.metric : (numCols[0] ?? "记录数");
  const dimCandidates = [...strCols, dateCol, ...numCols].filter(Boolean) as string[];
  const dim = dimCandidates.includes(a.dim) ? a.dim : (strCols[0] ?? dateCol ?? numCols[0] ?? "记录数");
  const agg: Agg = ["sum", "avg", "max", "min", "count"].includes(a.agg) ? a.agg : "sum";
  const granularity: Granularity = ["day", "week", "month", "none"].includes(a.granularity)
    ? a.granularity
    : dim === dateCol
      ? "day"
      : "none";
  return {
    metric,
    dim,
    agg,
    granularity,
    lastDays: typeof a.lastDays === "number" ? a.lastDays : undefined,
    filters: Array.isArray(a.filters) ? a.filters : undefined,
    limit: typeof a.limit === "number" ? a.limit : undefined,
    intent: a.intent ?? "trend",
  };
}

/** 根据查询规格与结果推荐图表类型并构建 ChartSpec */
export function chartFromResult(spec: QuerySpec, res: QueryResult, isDateDim = false): ChartSpec {
  const m = spec.metric;
  const range = res.stats.rangeLabel;
  if (spec.intent === "distribution") {
    return {
      type: "donut",
      title: `「${m}」按${spec.dim}构成 · ${range}`,
      xLabel: spec.dim,
      yLabel: m,
      series: res.series,
    };
  }
  if (spec.intent === "ranking") {
    return {
      type: "hbar",
      title: `「${m}」Top${spec.limit ?? 5} ${spec.dim} · ${range}`,
      xLabel: spec.dim,
      yLabel: m,
      series: res.series,
    };
  }
  if (spec.intent === "compare" && spec.seriesValues?.length === 2) {
    return {
      type: "line",
      title: `「${m}」${spec.seriesValues[0]} vs ${spec.seriesValues[1]} · ${range}`,
      xLabel: spec.dim,
      yLabel: m,
      series: res.series,
    };
  }
  return {
    type: "line",
    title: `「${m}」${isDateDim ? "走势" : `按${spec.dim}`} · ${range}`,
    xLabel: spec.dim,
    yLabel: m,
    series: res.series,
  };
}

/** 执行工具（本地引擎与真实模型通道共用） */
export function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const ds = ctx.dataset;
  switch (name) {
    case "query_data": {
      if (!ds) return { summary: "未选择数据集", data: null };
      const spec = specFromArgs(args, ds);
      const res = queryData(ds, spec);
      return {
        summary: `按${spec.dim}聚合${spec.metric}，共 ${fmtInt(res.stats.n)} 个数据点，总计 ${res.stats.total}`,
        data: { stats: res.stats, xKeys: res.xKeys },
        metrics: res.metrics,
        table: res.table,
      };
    }
    case "recommend_chart": {
      if (!ds) return { summary: "未选择数据集" };
      const spec = specFromArgs(args, ds);
      const res = queryData(ds, spec);
      return {
        summary: `推荐${spec.intent === "distribution" ? "环形图" : spec.intent === "ranking" ? "条形图" : "折线图"}`,
        data: { type: spec.intent },
        chart: chartFromResult(spec, res),
        metrics: res.metrics,
        table: res.table,
      };
    }
    case "get_overview": {
      if (!ds) return { summary: "未选择数据集", data: null };
      const ov = datasetOverview(ds);
      return {
        summary: `${fmtInt(ov.rowCount)} 行 × ${ov.colCount} 列${ov.dateRange ? `，${ov.dateRange.min} 至 ${ov.dateRange.max}` : ""}`,
        data: ov,
      };
    }
    case "detect_anomaly": {
      if (!ds) return { summary: "未选择数据集" };
      const dateCol = getDateColumn(ds);
      const spec = specFromArgs({ ...args, dim: dateCol, granularity: "day" }, ds);
      const res = queryData(ds, spec);
      const anomalies = detectAnomalies(res);
      const flagged = res.series[0].points.map((p, i) => {
        const hit = anomalies.find((a) => a.label === p.x);
        return hit ? { ...p, flag: "anomaly" as const } : p;
      });
      const chart: ChartSpec = {
        type: "line",
        title: `「${spec.metric}」异常检测 · ${res.stats.rangeLabel}`,
        xLabel: spec.dim,
        yLabel: spec.metric,
        series: [{ name: spec.metric, points: flagged }],
      };
      return {
        summary: anomalies.length ? `检测到 ${anomalies.length} 个异常点` : "未检测到显著异常点",
        data: anomalies,
        chart,
        metrics: res.metrics,
        table: res.table,
      };
    }
    case "forecast": {
      if (!ds) return { summary: "未选择数据集" };
      const dateCol = getDateColumn(ds);
      const spec = specFromArgs({ ...args, dim: dateCol, granularity: "day" }, ds);
      const res = queryData(ds, spec);
      const fc = forecastSeries(res, typeof args.steps === "number" ? args.steps : 7);
      if (!fc) return { summary: "数据点不足，无法预测" };
      return {
        summary: `线性趋势斜率 ${fc.slope}，未来 ${typeof args.steps === "number" ? args.steps : 7} 期预计 ${fc.projected}`,
        data: fc,
        chart: {
          type: "line",
          title: `「${spec.metric}」趋势预测（演示） · ${res.stats.rangeLabel}`,
          xLabel: "时间",
          yLabel: spec.metric,
          series: fc.series,
          forecast: true,
        },
        metrics: res.metrics,
        table: res.table,
      };
    }
    case "search_knowledge": {
      const docs = ctx.docs ?? [];
      if (docs.length === 0) return { summary: "知识库为空" };
      const rag = ragAnswer(String(args.query ?? ""), docs);
      if (!rag.used) return { summary: "未命中高相关片段（阈值 0.08）", data: null };
      return {
        summary: `命中 ${rag.citations.length} 个片段，来自 ${new Set(rag.citations.map((c) => c.source)).size} 篇文档`,
        data: rag.citations,
      };
    }
    case "analyze_correlation": {
      if (!ds) return { summary: "未选择数据集" };
      const numCols = getNumericColumns(ds);
      const m1 = numCols.includes(String(args.metric)) ? String(args.metric) : numCols[0];
      const m2 = numCols.includes(String(args.metric2)) ? String(args.metric2) : (numCols.find((c) => c !== m1) ?? m1);
      const c = correlationData(ds, m1, m2);
      return {
        summary: `皮尔逊相关系数 r = ${c.r}（n=${c.n}）`,
        data: { r: c.r, n: c.n },
        chart: {
          type: "scatter",
          title: `「${m1} × ${m2}」相关性分布`,
          xLabel: m1,
          yLabel: m2,
          series: c.series,
        },
        table: c.table,
      };
    }
    default:
      return { summary: `未知工具：${name}` };
  }
}
