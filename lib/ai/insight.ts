/**
 * 洞察文本生成：基于真实计算结果生成自然语言解读
 * 所有数字均来自 queryData / correlationData 的真实统计，无虚构。
 */

import type { ChartSpec, DatasetPayload, MetricItem } from "../types";
import {
  correlationData,
  datasetOverview,
  detectAnomalies,
  forecastSeries,
  queryData,
  type QueryResult,
  type QuerySpec,
} from "./dataops";
import { fmtInt, fmtMetric, fmtPct } from "../utils";

function trendWord(changePct: number | null): string {
  if (changePct == null) return "平稳波动";
  if (changePct > 15) return "显著上升";
  if (changePct > 3) return "温和上升";
  if (changePct >= -3) return "基本平稳";
  if (changePct >= -15) return "小幅回落";
  return "明显下降";
}

const SUGGESTIONS: Record<string, string> = {
  trend: "建议关注峰值时段的资源投入效率，并对回落时段做驱动因素归因（流量、转化、客单价）。",
  compare: "建议将领先方的运营动作沉淀为可复制经验，并针对落后渠道做漏斗诊断，定位瓶颈环节。",
  distribution: "头部类别贡献显著，可在巩固头部优势的同时，设计长尾类别的交叉销售与流量扶持策略。",
  ranking: "建议持续监控头部与尾部的差距变化，建立动态预警，及时调整资源分配权重。",
  correlation: "相关性可作为运营参考假设，但需结合业务逻辑进一步验证因果关系，避免误判。",
  anomaly: "建议对异常点回溯当时的运营动作与外部事件，先排除数据采集与埋点问题，再定位业务原因。",
  forecast: "预测基于线性趋势外推，仅作演示参考；实际决策请结合业务节奏、季节性与突发事件动态修正。",
  report: "建议将上述发现转化为可执行的运营动作，并按周复盘核心指标的边际变化。",
};

/** 根据意图与查询结果生成完整的流式解读文本 */
export function composeInsight(
  ds: DatasetPayload,
  spec: QuerySpec,
  res: QueryResult
): string {
  const m = fmtMetric.bind(null, spec.metric);
  const s = res.stats;
  const parts: string[] = [];

  if (spec.intent === "trend" || spec.intent === "report") {
    parts.push(
      `${s.rangeLabel}，「${spec.metric}」${spec.agg === "avg" ? "平均" : "总"}计 ${m(s.total)}，` +
        `期间均值 ${m(s.avg)}，整体呈${trendWord(s.changePct)}。`
    );
    if (s.changePct != null && s.prevTotal != null) {
      parts.push(
        `与上一周期（${m(s.prevTotal)}）相比${s.changePct >= 0 ? "上升" : "下降"} ${fmtPct(Math.abs(s.changePct))}。`
      );
    }
    parts.push(
      `峰值出现在 ${s.peak.label}（${m(s.peak.value)}），低点为 ${s.low.label}（${m(s.low.value)}）。`
    );
    parts.push("");
    parts.push("· 波动特征：峰值与低点相差 " + fmtPct(((s.peak.value - s.low.value) / (s.low.value || 1)) * 100, false) + "，建议结合运营日历定位高低谷成因");
    const catCol = ds.columns.find((c) => c.type === "string");
    if (catCol) {
      const top = topCategoryShare(ds, spec.metric, catCol.name, spec);
      if (top) parts.push(`· 结构特征：${top.name} 在${spec.metric}中占比最高（${fmtPct(top.share, false)}），是主要驱动来源`);
    }
    parts.push("");
    parts.push(SUGGESTIONS.trend);
  } else if (spec.intent === "distribution" || spec.intent === "ranking") {
    const pts = res.series[0].points;
    const total = pts.reduce((sum, p) => sum + p.y, 0);
    const top3 = pts.slice(0, 3).reduce((sum, p) => sum + p.y, 0);
    parts.push(
      `按「${spec.dim}」拆分，「${spec.metric}」总计 ${m(total)}，共 ${pts.length} 个${spec.dim}。`
    );
    parts.push(
      `${pts[0]?.x ?? "-"} 以 ${m(pts[0]?.y ?? 0)} 位居首位（占比 ${fmtPct(total ? ((pts[0]?.y ?? 0) / total) * 100 : 0, false)}）。`
    );
    parts.push(`前三名合计占比 ${fmtPct(total ? (top3 / total) * 100 : 0, false)}。`);
    if (pts.length > 3) {
      const tail = pts.slice(3).reduce((sum, p) => sum + p.y, 0);
      parts.push(`其余 ${pts.length - 3} 个${spec.dim}合计占比 ${fmtPct(total ? (tail / total) * 100 : 0, false)}，呈${tail / total < 0.3 ? "明显头部集中" : "相对均衡"}的分布形态。`);
    }
    parts.push("");
    parts.push(SUGGESTIONS.distribution);
  } else if (spec.intent === "compare" && spec.seriesValues?.length === 2) {
    const [a, b] = res.series;
    const at = a.points.reduce((s, p) => s + p.y, 0);
    const bt = b.points.reduce((s, p) => s + p.y, 0);
    const diff = at - bt;
    parts.push(
      `对比「${a.name}」与「${b.name}」：${s.rangeLabel}内 ${a.name} ${m(at)}，${b.name} ${m(bt)}。`
    );
    parts.push(
      `${at >= bt ? a.name : b.name} 领先 ${m(Math.abs(diff))}（${fmtPct(bt === 0 || at === 0 ? 0 : (Math.abs(diff) / Math.min(at, bt)) * 100)}）。`
    );
    const aWins = a.points.filter((p, i) => p.y >= (b.points[i]?.y ?? 0)).length;
    parts.push(`分时段看，${a.name} 在 ${aWins}/${a.points.length} 个时段内不低于 ${b.name}。`);
    parts.push("");
    parts.push(SUGGESTIONS.compare);
  } else if (spec.intent === "correlation") {
    const { r, n } = correlationData(ds, spec.metric, spec.metric2 ?? spec.metric);
    const strength =
      Math.abs(r) >= 0.7 ? "强" : Math.abs(r) >= 0.4 ? "中等" : "弱";
    const dir = r >= 0 ? "正" : "负";
    parts.push(
      `对 ${n} 条记录做相关性分析：「${spec.metric}」与「${spec.metric2}」的皮尔逊相关系数 r = ${r}，呈${strength}${dir}相关。`
    );
    parts.push("");
    parts.push(SUGGESTIONS.correlation);
  } else if (spec.intent === "anomaly") {
    const anomalies = detectAnomalies(res);
    if (anomalies.length === 0) {
      parts.push(`${s.rangeLabel}内未发现显著异常点（Z-Score 阈值 1.8），${spec.metric}整体波动处于正常区间。`);
    } else {
      parts.push(`${s.rangeLabel}内检测到 ${anomalies.length} 个异常点（Z-Score > 1.8）：`);
      for (const a of anomalies.slice(0, 3)) {
        parts.push(`· ${a.label}：${m(a.value)}（Z = ${a.z}，${a.z > 0 ? "高于" : "低于"}均值）`);
      }
      parts.push("");
      parts.push(SUGGESTIONS.anomaly);
    }
  } else if (spec.intent === "forecast") {
    const fc = forecastSeries(res);
    if (!fc) {
      parts.push(`当前数据点较少（${res.stats.n} 个），不足以支撑可靠的趋势预测，建议扩大时间范围后重试。`);
    } else {
      parts.push(
        `基于近 ${Math.min(30, res.stats.n)} 个数据点的线性趋势，「${spec.metric}」整体${fc.slope >= 0 ? "向上" : "向下"}延伸（斜率 ${fc.slope >= 0 ? "+" : ""}${fmtInt(fc.slope)}/期）。`
      );
      parts.push(
        `未来 7 期预计达到 ${m(fc.projected)}（当前 ${m(fc.lastValue)}），变化幅度 ${fmtPct(((fc.projected - fc.lastValue) / (fc.lastValue || 1)) * 100)}。`
      );
      parts.push("");
      parts.push(SUGGESTIONS.forecast);
    }
  } else {
    parts.push(
      `已完成对「${spec.metric}」按「${spec.dim}」的分析：${s.rangeLabel}共 ${m(s.total)}，均值 ${m(s.avg)}，峰值 ${s.peak.label}（${m(s.peak.value)}）。`
    );
    parts.push("");
    parts.push(SUGGESTIONS.report);
  }
  return parts.join("\n");
}

/** 计算某类别列在指定指标上的头部占比 */
function topCategoryShare(
  ds: DatasetPayload,
  metric: string,
  dim: string,
  spec: QuerySpec
): { name: string; share: number } | null {
  try {
    const r = queryData(ds, {
      metric,
      dim,
      agg: "sum",
      granularity: "none",
      intent: "distribution",
      filters: spec.filters,
      limit: 1,
    });
    const p = r.series[0].points[0];
    const total = r.series[0].points.reduce((s, x) => s + x.y, 0);
    if (!p || !total) return null;
    return { name: p.x, share: (p.y / total) * 100 };
  } catch {
    return null;
  }
}

/** 生成结构化洞察报告（Markdown） */
export function composeReport(
  ds: DatasetPayload,
  questions: string[]
): string {
  const ov = datasetOverview(ds);
  const dateCol = ov.dateCol;
  const primary = ov.numeric[0];
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const lines: string[] = [];

  lines.push(`# 《${ds.name}》数据分析报告`);
  lines.push(`> 由 灵犀洞察 AI Agent 自动生成 · ${ts}`);
  lines.push("");
  lines.push("## 一、数据概览");
  lines.push("");
  lines.push(`- 数据规模：${fmtInt(ov.rowCount)} 行 × ${ov.colCount} 列`);
  if (ov.dateRange) {
    lines.push(`- 时间范围：${ov.dateRange.min} 至 ${ov.dateRange.max}`);
  }
  for (const c of ov.categories) {
    lines.push(`- 维度「${c.name}」：${fmtInt(c.count)} 个不同取值`);
  }
  lines.push("");
  lines.push("| 指标 | 总计 | 均值 | 最小值 | 最大值 |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const n of ov.numeric.slice(0, 6)) {
    lines.push(`| ${n.name} | ${fmtMetric(n.name, n.sum)} | ${fmtMetric(n.name, n.avg)} | ${fmtMetric(n.name, n.min)} | ${fmtMetric(n.name, n.max)} |`);
  }
  lines.push("");

  lines.push("## 二、核心发现");
  lines.push("");
  if (primary) {
    const spec: QuerySpec = {
      metric: primary.name,
      dim: dateCol ?? ds.columns.find((c) => c.type === "string")?.name ?? primary.name,
      agg: "sum",
      granularity: "day",
      intent: "trend",
    };
    const res = queryData(ds, spec);
    const s = res.stats;
    lines.push(
      `1. **整体表现**：${s.rangeLabel}「${primary.name}」合计 ${fmtMetric(primary.name, s.total)}，均值 ${fmtMetric(primary.name, s.avg)}，整体呈${trendWord(s.changePct)}${s.changePct != null ? `（环比 ${fmtPct(s.changePct)}）` : ""}。`
    );
    lines.push(
      `2. **峰值与低谷**：峰值出现在 ${s.peak.label}（${fmtMetric(primary.name, s.peak.value)}），低点为 ${s.low.label}（${fmtMetric(primary.name, s.low.value)}）。`
    );
    const catCol = ds.columns.find((c) => c.type === "string");
    if (catCol) {
      const dist = queryData(ds, {
        metric: primary.name,
        dim: catCol.name,
        agg: "sum",
        granularity: "none",
        intent: "distribution",
      });
      const p0 = dist.series[0].points[0];
      const total = dist.series[0].points.reduce((sx, p) => sx + p.y, 0);
      if (p0) {
        lines.push(
          `3. **结构集中度**：按「${catCol.name}」看，${p0.x} 占比最高（${fmtPct((p0.y / total) * 100, false)}），头部效应${p0.y / total > 0.4 ? "显著" : "适中"}。`
        );
      }
    }
    if (ov.numeric.length >= 2) {
      const c = correlationData(ds, ov.numeric[0].name, ov.numeric[1].name);
      lines.push(
        `4. **指标关联**：「${ov.numeric[0].name}」与「${ov.numeric[1].name}」相关系数 r = ${c.r}。`
      );
    }
  }
  lines.push("");

  lines.push("## 三、趋势分析");
  lines.push("");
  if (dateCol && primary) {
    const res = queryData(ds, {
      metric: primary.name,
      dim: dateCol,
      agg: "sum",
      granularity: "month",
      intent: "trend",
    });
    const pts = res.series[0].points;
    lines.push(`按月度汇总，「${primary.name}」变化如下：`);
    lines.push("");
    for (const p of pts) {
      lines.push(`- ${p.x}：${fmtMetric(primary.name, p.y)}`);
    }
  } else {
    lines.push("该数据集不含时间维度，跳过趋势分析。");
  }
  lines.push("");

  lines.push("## 四、行动建议");
  lines.push("");
  lines.push("1. 围绕峰值时段与头部类别制定资源倾斜策略，提升投入产出比；");
  lines.push("2. 对低点与长尾类别做归因分析，识别可干预的增长机会；");
  lines.push("3. 建立核心指标的周度监控看板，将异常检测纳入日常运营流程。");
  lines.push("");
  lines.push("## 五、本次会话覆盖的问题");
  lines.push("");
  if (questions.length) {
    for (const q of questions.slice(-8)) lines.push(`- ${q}`);
  } else {
    lines.push("- （无）");
  }
  lines.push("");
  lines.push("---");
  lines.push("*本报告由灵犀洞察本地演示引擎基于真实计算生成；接入真实大模型后，解读文本的深度与个性化程度将进一步提升。*");
  return lines.join("\n");
}
