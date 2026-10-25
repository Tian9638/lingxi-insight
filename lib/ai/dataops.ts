/**
 * 数据查询引擎：对数据集执行过滤 / 分组 / 聚合 / 排序，产出
 * 可直接渲染的序列（图表）、表格与指标卡数据。
 * 所有统计数值均为真实计算，不使用任何占位假数据。
 */

import type {
  ChartPoint,
  ChartSeries,
  DatasetPayload,
  MetricItem,
  TableSpec,
} from "../types";
import {
  addDays,
  daysBetween,
  fmtInt,
  fmtMetric,
  fmtMonthLabel,
  fmtPct,
  fmtWeekLabel,
  monthKey,
  parseDate,
  weekStart,
} from "../utils";

export type Agg = "sum" | "avg" | "max" | "min" | "count";
export type Granularity = "day" | "week" | "month" | "none";
export type Intent =
  | "trend"
  | "compare"
  | "distribution"
  | "ranking"
  | "correlation"
  | "anomaly"
  | "forecast"
  | "report"
  | "qa"
  | "greeting"
  | "unclear";

export interface QuerySpec {
  /** 主指标（数值列） */
  metric: string;
  /** X 轴维度（日期列 / 类别列 / 数值列） */
  dim: string;
  /** 序列拆分维度（对比场景，如「渠道」） */
  seriesDim?: string;
  /** 对比的两个取值 */
  seriesValues?: string[];
  /** 相关性分析的第二指标 */
  metric2?: string;
  agg: Agg;
  granularity: Granularity;
  lastDays?: number;
  period?: "this" | "last" | "year";
  year?: number;
  filters?: { column: string; values: string[] }[];
  limit?: number;
  intent: Intent;
}

export interface QueryStats {
  total: number;
  avg: number;
  peak: { label: string; value: number };
  low: { label: string; value: number };
  n: number;
  prevTotal: number | null;
  changePct: number | null;
  rangeLabel: string;
}

export interface QueryResult {
  series: ChartSeries[];
  table: TableSpec;
  metrics: MetricItem[];
  stats: QueryStats;
  /** 未格式化的分组键（预测/异常检测需要） */
  xKeys: string[];
  xIsDate: boolean;
  /** 每个分组的数据条数 */
  counts: number[];
}

// ---------- 基础工具 ----------

export function getDateColumn(ds: DatasetPayload): string | undefined {
  return ds.columns.find((c) => c.type === "date")?.name;
}

export function getNumericColumns(ds: DatasetPayload): string[] {
  return ds.columns.filter((c) => c.type === "number").map((c) => c.name);
}

export function getCategoryColumns(ds: DatasetPayload): string[] {
  return ds.columns.filter((c) => c.type === "string").map((c) => c.name);
}

export function distinctValues(ds: DatasetPayload, col: string): string[] {
  return [...new Set(ds.rows.map((r) => String(r[col])))];
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function aggValue(a: { sum: number; count: number; max: number; min: number }, agg: Agg): number {
  switch (agg) {
    case "avg":
      return a.count ? a.sum / a.count : 0;
    case "max":
      return a.max;
    case "min":
      return a.min;
    case "count":
      return a.count;
    default:
      return a.sum;
  }
}

function xKeyOf(raw: string, granularity: Granularity): string {
  if (granularity === "week") return weekStart(raw);
  if (granularity === "month") return monthKey(raw);
  return raw;
}

function xLabelOf(raw: string, granularity: Granularity, xIsDate: boolean): string {
  if (!xIsDate) return raw;
  if (granularity === "week") return fmtWeekLabel(raw);
  if (granularity === "month") return fmtMonthLabel(raw);
  const { m, d } = parseDate(raw);
  return `${m}月${d}日`;
}

/** 计算时间过滤范围 [from, to] */
function resolveTimeRange(
  ds: DatasetPayload,
  spec: QuerySpec,
  dateCol: string
): { from?: string; to?: string } {
  let max = "";
  let min = "";
  for (const r of ds.rows) {
    const d = String(r[dateCol]);
    if (!max || d > max) max = d;
    if (!min || d < min) min = d;
  }
  if (!max) return {};
  const to = max;
  if (spec.lastDays) return { from: addDays(max, -(spec.lastDays - 1)), to };
  if (spec.year) return { from: `${spec.year}-01-01`, to: `${spec.year}-12-31` };
  if (spec.period === "this") {
    const { y, m } = parseDate(max);
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to };
  }
  if (spec.period === "last") {
    const { y, m } = parseDate(max);
    const firstOfThis = new Date(y, m - 1, 1);
    const firstOfLast = new Date(y, m - 2, 1);
    const lastOfLast = new Date(firstOfThis.getTime() - 86400000);
    const p = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { from: p(firstOfLast), to: p(lastOfLast) };
  }
  if (spec.period === "year") {
    const { y } = parseDate(max);
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { from: min, to };
}

function rangeLabelOf(spec: QuerySpec, from?: string, to?: string): string {
  if (spec.lastDays) return `最近${spec.lastDays}天`;
  if (spec.year) return `${spec.year}年`;
  if (spec.period === "this") return "本月";
  if (spec.period === "last") return "上月";
  if (spec.period === "year") return "本年度";
  if (from && to) return `${from.slice(5).replace("-", "/")} 至 ${to.slice(5).replace("-", "/")}`;
  return "全部周期";
}

// ---------- 主查询 ----------

export function queryData(ds: DatasetPayload, spec: QuerySpec): QueryResult {
  const dateCol = getDateColumn(ds);
  const xIsDate = spec.dim === dateCol && !!dateCol;
  const { from, to } =
    xIsDate || spec.lastDays || spec.period || spec.year
      ? resolveTimeRange(ds, spec, dateCol!)
      : {};

  // 1. 行过滤
  let rows = ds.rows;
  if (from && to && dateCol) {
    rows = rows.filter((r) => {
      const d = String(r[dateCol]);
      return d >= from! && d <= to!;
    });
  }
  if (spec.filters) {
    for (const f of spec.filters) {
      rows = rows.filter((r) => f.values.includes(String(r[f.column])));
    }
  }
  if (spec.seriesDim && spec.seriesValues) {
    rows = rows.filter((r) => spec.seriesValues!.includes(String(r[spec.seriesDim!])));
  }

  const agg = spec.agg === "count" ? "count" : spec.agg;
  const acc = () => ({ sum: 0, count: 0, max: -Infinity, min: Infinity });

  // 2. 分组聚合
  const groups = new Map<string, ReturnType<typeof acc>>();
  const seriesGroups = new Map<string, Map<string, ReturnType<typeof acc>>>();
  const seriesNames = spec.seriesValues ?? [spec.metric];

  for (const r of rows) {
    const raw = String(r[spec.dim]);
    const key = xIsDate ? xKeyOf(raw, spec.granularity) : raw;
    const v = spec.metric === "记录数" ? 1 : num(r[spec.metric]);
    if (spec.seriesDim && spec.seriesValues) {
      const sv = String(r[spec.seriesDim]);
      if (!seriesGroups.has(sv)) seriesGroups.set(sv, new Map());
      const inner = seriesGroups.get(sv)!;
      const a = inner.get(key) ?? acc();
      a.sum += v;
      a.count += 1;
      a.max = Math.max(a.max, v);
      a.min = Math.min(a.min, v);
      inner.set(key, a);
    } else {
      const a = groups.get(key) ?? acc();
      a.sum += v;
      a.count += 1;
      a.max = Math.max(a.max, v);
      a.min = Math.min(a.min, v);
      groups.set(key, a);
    }
  }

  // 3. 排序（时间轴升序，类别轴按值降序）
  let keys = [...(spec.seriesDim ? (seriesGroups.get(seriesNames[0]) ?? new Map()).keys() : groups.keys())];
  if (xIsDate || spec.dim === "周次") {
    keys.sort((a, b) => (xIsDate ? a.localeCompare(b) : Number(a) - Number(b)));
  } else {
    const val = (k: string) =>
      aggValue(groups.get(k) ?? acc(), agg);
    keys.sort((a, b) => val(b) - val(a));
  }
  if (spec.limit && !xIsDate && spec.dim !== "周次") keys = keys.slice(0, spec.limit);

  const counts = keys.map((k) => {
    const m = spec.seriesDim ? seriesGroups.get(seriesNames[0]) : groups;
    return m?.get(k)?.count ?? 0;
  });

  // 4. 组装序列
  let series: ChartSeries[];
  if (spec.seriesDim && spec.seriesValues) {
    series = spec.seriesValues.map((sv) => {
      const inner = seriesGroups.get(sv) ?? new Map();
      const points: ChartPoint[] = keys.map((k) => ({
        x: xLabelOf(k, spec.granularity, xIsDate),
        y: round(aggValue(inner.get(k) ?? acc(), agg)),
      }));
      return { name: sv, points };
    });
  } else {
    const points: ChartPoint[] = keys.map((k) => ({
      x: xLabelOf(k, spec.granularity, xIsDate),
      y: round(aggValue(groups.get(k) ?? acc(), agg)),
    }));
    series = [
      {
        name: xIsDate || spec.dim === "周次" ? spec.metric : `${spec.metric} · 按${spec.dim}`,
        points,
      },
    ];
  }

  // 5. 统计量（以主序列为准）
  const mainPoints = series[0].points;
  const total = round(mainPoints.reduce((s, p) => s + p.y, 0));
  const avg = mainPoints.length ? round(total / mainPoints.length) : 0;
  const peak = mainPoints.reduce(
    (best, p) => (p.y > best.value ? { label: p.x, value: p.y } : best),
    { label: "-", value: -Infinity }
  );
  const low = mainPoints.reduce(
    (best, p) => (p.y < best.value ? { label: p.x, value: p.y } : best),
    { label: "-", value: Infinity }
  );

  // 上一周期（仅时间序列）
  let prevTotal: number | null = null;
  if (xIsDate && from && to && dateCol) {
    const span = daysBetween(from, to) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(span - 1));
    let sum = 0;
    let hit = false;
    for (const r of ds.rows) {
      const d = String(r[dateCol]);
      if (d >= prevFrom && d <= prevTo) {
        sum += spec.metric === "记录数" ? 1 : num(r[spec.metric]);
        hit = true;
      }
    }
    if (hit) prevTotal = round(sum);
  }
  const changePct =
    prevTotal && prevTotal > 0 ? round(((total - prevTotal) / prevTotal) * 100) : null;

  const stats: QueryStats = {
    total,
    avg,
    peak: { label: peak.label, value: peak.value === -Infinity ? 0 : peak.value },
    low: { label: low.label, value: low.value === Infinity ? 0 : low.value },
    n: mainPoints.length,
    prevTotal,
    changePct,
    rangeLabel: rangeLabelOf(spec, from, to),
  };

  // 6. 指标卡
  const metrics: MetricItem[] = [];
  if (spec.seriesDim && spec.seriesValues && series.length === 2) {
    const a = round(series[0].points.reduce((s, p) => s + p.y, 0));
    const b = round(series[1].points.reduce((s, p) => s + p.y, 0));
    const diff = round(a - b);
    metrics.push(
      { label: series[0].name, value: fmtMetric(spec.metric, a) },
      { label: series[1].name, value: fmtMetric(spec.metric, b) },
      {
        label: "差值",
        value: `${diff >= 0 ? "+" : ""}${fmtMetric(spec.metric, Math.abs(diff) === diff ? diff : diff)}`,
        trend: diff >= 0 ? "up" : "down",
        hint: `${series[0].name} 相对 ${series[1].name}`,
      },
      {
        label: "领先方",
        value: a >= b ? series[0].name : series[1].name,
        hint: a >= b ? `领先 ${fmtPct(b === 0 ? 100 : ((a - b) / b) * 100)}` : `领先 ${fmtPct(a === 0 ? 100 : ((b - a) / a) * 100)}`,
      }
    );
  } else if (spec.intent === "distribution" || spec.intent === "ranking") {
    const share = (v: number) => (total > 0 ? (v / total) * 100 : 0);
    metrics.push(
      { label: `${spec.metric}总计`, value: fmtMetric(spec.metric, total) },
      { label: "类别数", value: fmtInt(keys.length) },
      {
        label: "头部占比",
        value: fmtPct(share(mainPoints[0]?.y ?? 0), false),
        hint: `${mainPoints[0]?.x ?? "-"} 贡献`,
      },
      { label: "领先类别", value: mainPoints[0]?.x ?? "-", hint: fmtMetric(spec.metric, mainPoints[0]?.y ?? 0) }
    );
  } else {
    metrics.push(
      {
        label: `${spec.metric}总计`,
        value: fmtMetric(spec.metric, total),
        delta: changePct != null ? fmtPct(changePct) : undefined,
        trend: changePct == null ? "flat" : changePct >= 0 ? "up" : "down",
        hint: stats.rangeLabel,
      },
      { label: `平均${agg === "avg" ? "" : "每期"}`, value: fmtMetric(spec.metric, avg) },
      {
        label: "峰值",
        value: fmtMetric(spec.metric, stats.peak.value),
        hint: stats.peak.label,
      },
      { label: "数据点", value: fmtInt(stats.n), hint: stats.rangeLabel }
    );
  }

  // 7. 表格
  let table: TableSpec;
  if (spec.seriesDim && spec.seriesValues && series.length === 2) {
    table = {
      columns: [spec.dim, series[0].name, series[1].name],
      rows: keys.slice(0, 12).map((k, i) => [
        xLabelOf(k, spec.granularity, xIsDate),
        fmtMetric(spec.metric, series[0].points[i]?.y ?? 0),
        fmtMetric(spec.metric, series[1].points[i]?.y ?? 0),
      ]),
    };
  } else if (spec.intent === "distribution" || spec.intent === "ranking") {
    table = {
      columns: [spec.dim, spec.metric, "占比"],
      rows: mainPoints.slice(0, 12).map((p) => [
        p.x,
        fmtMetric(spec.metric, p.y),
        total > 0 ? fmtPct((p.y / total) * 100, false) : "-",
      ]),
    };
  } else {
    table = {
      columns: [xIsDate || spec.dim === "周次" ? spec.dim : spec.dim, spec.metric],
      rows: mainPoints.slice(-14).map((p) => [p.x, fmtMetric(spec.metric, p.y)]),
    };
  }

  return { series, table, metrics, stats, xKeys: keys, xIsDate, counts };
}

// ---------- 相关性分析 ----------

export function correlationData(
  ds: DatasetPayload,
  m1: string,
  m2: string
): { series: ChartSeries[]; r: number; n: number; table: TableSpec } {
  const pts = ds.rows
    .map((r) => ({ a: num(r[m1]), b: num(r[m2]) }))
    .filter((p) => p.a !== 0 || p.b !== 0);
  const n = pts.length;
  const ma = pts.reduce((s, p) => s + p.a, 0) / (n || 1);
  const mb = pts.reduce((s, p) => s + p.b, 0) / (n || 1);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (const p of pts) {
    cov += (p.a - ma) * (p.b - mb);
    va += (p.a - ma) ** 2;
    vb += (p.b - mb) ** 2;
  }
  const r = va > 0 && vb > 0 ? round(cov / Math.sqrt(va * vb)) : 0;
  const series: ChartSeries[] = [
    {
      name: `${m1} × ${m2}`,
      points: pts.slice(0, 300).map((p) => ({ x: String(p.b), y: p.b, nx: p.a })),
    },
  ];
  return {
    series,
    r,
    n,
    table: {
      columns: [m1, m2],
      rows: pts.slice(0, 12).map((p) => [fmtInt(p.a), fmtInt(p.b)]),
    },
  };
}

// ---------- 异常检测（Z-Score） ----------

export function detectAnomalies(result: QueryResult): { label: string; z: number; value: number }[] {
  const values = result.series[0].points.map((p) => p.y);
  const n = values.length;
  if (n < 5) return [];
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
  const out: { label: string; z: number; value: number }[] = [];
  result.series[0].points.forEach((p, i) => {
    const z = (p.y - mean) / sd;
    if (Math.abs(z) > 1.8) out.push({ label: p.x, z: round(z), value: p.y });
  });
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 5);
}

// ---------- 线性趋势预测（演示性） ----------

export function forecastSeries(
  result: QueryResult,
  steps = 7
): { series: ChartSeries[]; slope: number; lastValue: number; projected: number } | null {
  const pts = result.series[0].points;
  if (pts.length < 4) return null;
  const use = pts.slice(-Math.min(30, pts.length));
  const n = use.length;
  const sx = use.reduce((s, _, i) => s + i, 0);
  const sy = use.reduce((s, p) => s + p.y, 0);
  const sxy = use.reduce((s, p, i) => s + i * p.y, 0);
  const sxx = use.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const lastRaw = result.xKeys[result.xKeys.length - 1];
  const isDate = result.xIsDate;
  const projectedPts: ChartPoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const v = round(intercept + slope * (n - 1 + i));
    let label: string;
    if (isDate) {
      const d = addDays(lastRaw, i);
      label = `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
    } else {
      label = `+${i}`;
    }
    projectedPts.push({ x: label, y: v });
  }
  return {
    series: [
      { name: "实际", points: use },
      {
        name: "预测（演示）",
        dashed: true,
        points: [use[use.length - 1], ...projectedPts],
      },
    ],
    slope: round(slope),
    lastValue: use[use.length - 1].y,
    projected: projectedPts[projectedPts.length - 1].y,
  };
}

// ---------- 数据集概览（报告用） ----------

export function datasetOverview(ds: DatasetPayload) {
  const dateCol = getDateColumn(ds);
  let min = "";
  let max = "";
  if (dateCol) {
    for (const r of ds.rows) {
      const d = String(r[dateCol]);
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
  }
  const numeric = getNumericColumns(ds).map((name) => {
    const vals = ds.rows.map((r) => num(r[name]));
    const sum = vals.reduce((s, v) => s + v, 0);
    return {
      name,
      sum: round(sum),
      avg: round(sum / (vals.length || 1)),
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  });
  return {
    rowCount: ds.rows.length,
    colCount: ds.columns.length,
    dateCol,
    dateRange: min && max ? { min, max } : null,
    numeric,
    categories: getCategoryColumns(ds).map((name) => ({
      name,
      count: distinctValues(ds, name).length,
    })),
  };
}
