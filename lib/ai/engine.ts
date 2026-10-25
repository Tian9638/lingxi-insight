/**
 * Agent 编排引擎（本地演示通道）
 *
 * 采用 ReAct（Reasoning + Acting）循环：
 *   规划(plan) -> 工具调用(tool_call) -> 观察(tool_result) -> 生成(text) -> 收尾(usage/done)
 * 全过程以 AgentEvent 事件流输出，前端可实时渲染「AI 思考过程」。
 *
 * 设计约束：所有数字必须来自 dataops 的真实计算；文本为模板化合成为
 * 可解释、可审计的确定性输出（接入真实模型后由 LLM 替代文本生成层，
 * 工具层完全复用，见 openai.ts）。
 */

import type { AgentEvent, AgentInput } from "../types";
import { checkGuard, FALLBACK_REPLY } from "./guard";
import { classifyIntent, parseQuery } from "./nlp";
import {
  correlationData,
  detectAnomalies,
  forecastSeries,
  getDateColumn,
  queryData,
} from "./dataops";
import { chartFromResult, executeTool } from "./tools";
import { composeInsight, composeReport } from "./insight";
import { ragAnswer } from "./rag";
import { rid, sleep } from "../utils";

/** 模拟真实 LLM 的逐字流式输出（标点处自然停顿） */
async function* streamText(text: string, model: "pro" | "lite"): AsyncGenerator<string> {
  const base = model === "pro" ? 18 : 10;
  let i = 0;
  while (i < text.length) {
    const size = 2 + Math.floor(Math.random() * 4);
    let end = Math.min(i + size, text.length);
    if (text[end] === "\n") end += 1;
    yield text.slice(i, end);
    i = end;
    const punct = /[。！？，、；：\n]/.test(text[i - 1] ?? "");
    await sleep(base + Math.random() * base + (punct ? 60 : 0));
  }
}

function planFor(
  intent: string,
  spec: ReturnType<typeof parseQuery>,
  deep: boolean,
  model: "pro" | "lite"
): string[] {
  const steps = [`解析用户意图：${intentLabel(intent)}（指标「${spec.metric}」· 维度「${spec.dim}」）`];
  steps.push(`解析查询条件：${rangeDesc(spec)}`);
  if (deep || model === "pro") {
    steps.push("数据质量检查：空值率 / 类型校验 / 量纲检查");
  }
  steps.push(`规划分析路径：过滤 → 分组聚合 → 智能图表推荐 → 洞察生成`);
  if (intent === "anomaly") steps.push("执行 Z-Score 异常检测");
  if (intent === "forecast") steps.push("执行线性趋势外推预测");
  if (intent === "correlation") steps.push("执行 Pearson 相关性分析");
  if (intent === "report") steps.push("汇总多维指标，生成结构化报告");
  if (deep) steps.push("交叉验证：与上一周期及结构拆分结果比对");
  steps.push("流式生成自然语言解读");
  return steps;
}

function intentLabel(intent: string): string {
  const map: Record<string, string> = {
    trend: "趋势分析",
    compare: "对比分析",
    distribution: "分布/占比分析",
    ranking: "排名分析",
    correlation: "相关性分析",
    anomaly: "异常检测",
    forecast: "趋势预测",
    report: "综合报告",
    greeting: "通用对话",
    unclear: "意图待澄清",
    qa: "知识问答",
  };
  return map[intent] ?? intent;
}

function rangeDesc(spec: ReturnType<typeof parseQuery>): string {
  const parts: string[] = [];
  if (spec.lastDays) parts.push(`最近${spec.lastDays}天`);
  if (spec.period === "this") parts.push("本月");
  if (spec.period === "last") parts.push("上月");
  if (spec.period === "year") parts.push("本年度");
  if (spec.year) parts.push(`${spec.year}年`);
  if (spec.filters?.length) parts.push(spec.filters.map((f) => `${f.column}∈{${f.values.join("/")}}`).join("，"));
  if (spec.seriesValues?.length) parts.push(`对比 ${spec.seriesValues.join(" vs ")}`);
  if (spec.limit) parts.push(`Top ${spec.limit}`);
  return parts.length ? parts.join(" · ") : "全部数据";
}

export async function* runAgent(input: AgentInput): AsyncGenerator<AgentEvent> {
  const t0 = Date.now();
  const requestId = rid("req-");
  const model = input.model;
  const q = input.question.trim();

  yield { type: "meta", model: model === "pro" ? "灵犀-Pro" : "灵犀-Lite", requestId, deep: input.deep, channel: "local" };

  // ---- 0. 输入护栏 ----
  const guard = checkGuard(q);
  if (!guard.ok) {
    for await (const d of streamText(guard.reply!, model)) yield { type: "text", delta: d };
    yield { type: "done", ok: true };
    return;
  }

  const intent = classifyIntent(q);
  const docish = /知识库|文档|资料|上传|文件|论文|手册|说明书/.test(q);
  const useRag =
    !!input.docs?.length &&
    (docish || (input.ragOn && (intent === "greeting" || intent === "unclear")));

  // ---- 1. RAG 知识库路径 ----
  if (useRag) {
    yield {
      type: "plan",
      steps: [
        "解析检索意图",
        "文档切片（160 字符滑动窗口，重叠 40）",
        "TF-IDF 向量化与余弦相似度检索 Top 3",
        "生成带引用的回答",
      ],
    };
    await sleep(240);
    const callId = rid("tool-");
    yield {
      type: "tool_call",
      id: callId,
      name: "search_knowledge",
      label: "知识库检索（TF-IDF）",
      args: { query: q, topK: 3 },
    };
    await sleep(model === "pro" ? 520 : 260);
    const rag = ragAnswer(q, input.docs!);
    if (rag.used) {
      yield {
        type: "tool_result",
        id: callId,
        ok: true,
        summary: `命中 ${rag.citations.length} 个片段，来自 ${new Set(rag.citations.map((c) => c.source)).size} 篇文档`,
      };
      yield { type: "citations", items: rag.citations };
      for await (const d of streamText(rag.answer, model)) yield { type: "text", delta: d };
      yield {
        type: "usage",
        promptTokens: q.length + 320,
        completionTokens: rag.answer.length,
        toolCalls: 1,
        latencyMs: Date.now() - t0,
      };
      yield { type: "done", ok: true };
      return;
    }
    yield {
      type: "tool_result",
      id: callId,
      ok: false,
      summary: "未命中高相关片段（相关度阈值 0.08），回退至数据分析通道",
    };
    yield { type: "text", delta: "知识库中暂未找到与问题高度相关的内容，以下按数据分析通道处理。\n\n" };
  }

  // ---- 2. 无数据集：通用对话 ----
  if (!input.dataset) {
    yield { type: "plan", steps: ["理解用户意图", "检索平台能力清单", "生成回复"] };
    await sleep(200);
    const reply =
      intent === "greeting"
        ? `你好，我是灵犀洞察的 AI 分析助手。\n\n我可以：\n· 对话式查询数据集（趋势 / 占比 / 排名 / 对比 / 相关性 / 异常 / 预测）\n· 自动推荐图表并流式生成洞察\n· 检索你上传的知识库文档并给出引用\n\n在左侧选择或上传一个数据集，就可以直接问我问题了。`
        : `这个问题需要数据支撑。请先在左侧选择内置数据集，或上传一份 CSV 文件，我就能开始分析。`;
    for await (const d of streamText(reply, model)) yield { type: "text", delta: d };
    yield { type: "done", ok: true };
    return;
  }

  const ds = input.dataset;
  const spec = parseQuery(q, ds, intent);
  const dateCol = getDateColumn(ds);
  const isDateDim = spec.dim === dateCol;

  // ---- 3.5 问候 / 意图待澄清：不进入查询路径，给出引导 ----
  if (intent === "greeting") {
    yield { type: "plan", steps: ["理解用户意图：通用对话", "生成平台能力介绍"] };
    await sleep(180);
    const reply = `你好，我是灵犀洞察的 AI 分析助手，当前已加载《${ds.name}》。\n\n你可以直接问我：\n· 「近30天${ds.columns.find((c) => c.type === "number")?.name ?? "核心指标"}的趋势如何？」\n· 「各维度占比是多少？」\n· 「对比两个维度取值的表现」\n· 「生成一份洞察报告」`;
    for await (const d of streamText(reply, model)) yield { type: "text", delta: d };
    yield { type: "done", ok: true };
    return;
  }
  if (intent === "unclear") {
    yield { type: "plan", steps: ["解析用户意图：置信度不足", "生成澄清引导"] };
    await sleep(180);
    for await (const d of streamText(clarifyReply(ds.name), model)) yield { type: "text", delta: d };
    yield { type: "done", ok: true };
    return;
  }

  // ---- 4. 报告意图 ----
  if (intent === "report") {
    yield {
      type: "plan",
      steps: [
        "解析用户意图：综合报告",
        "计算数据集概览与多维指标",
        "按月聚合时间序列",
        "计算类别集中度与指标相关性",
        "生成结构化 Markdown 报告",
      ],
    };
    await sleep(300);
    const questions = input.history.filter((h) => h.role === "user").map((h) => h.content);
    const md = composeReport(ds, questions);
    for await (const d of streamText(md, model)) yield { type: "text", delta: d };
    yield {
      type: "usage",
      promptTokens: q.length + 480,
      completionTokens: md.length,
      toolCalls: 0,
      latencyMs: Date.now() - t0,
    };
    yield { type: "done", ok: true };
    return;
  }

  // ---- 4. 数据分析路径 ----
  yield { type: "plan", steps: planFor(intent, spec, input.deep, model) };
  await sleep(model === "pro" ? 320 : 160);

  // 4.1 可选：数据质量检查（深度模式）
  if (input.deep) {
    const callId = rid("tool-");
    yield {
      type: "tool_call",
      id: callId,
      name: "get_overview",
      label: "数据集概览",
      args: {},
    };
    await sleep(280);
    const ov = executeTool("get_overview", {}, { dataset: ds });
    yield { type: "tool_result", id: callId, ok: true, summary: ov.summary };
  }

  // 4.2 相关性分析
  if (intent === "correlation") {
    const callId = rid("tool-");
    yield {
      type: "tool_call",
      id: callId,
      name: "analyze_correlation",
      label: "相关性分析（Pearson）",
      args: { metric: spec.metric, metric2: spec.metric2 },
    };
    await sleep(model === "pro" ? 480 : 240);
    const out = executeTool("analyze_correlation", { metric: spec.metric, metric2: spec.metric2 }, { dataset: ds });
    yield {
      type: "tool_result",
      id: callId,
      ok: true,
      summary: out.summary,
      chart: out.chart,
      table: out.table,
    };
    const text = composeInsight(ds, spec, emptyResult(spec));
    for await (const d of streamText(text, model)) yield { type: "text", delta: d };
    yield {
      type: "usage",
      promptTokens: q.length + 260,
      completionTokens: text.length,
      toolCalls: 1,
      latencyMs: Date.now() - t0,
    };
    yield { type: "done", ok: true };
    return;
  }

  // 4.3 数据查询
  const callId = rid("tool-");
  yield {
    type: "tool_call",
    id: callId,
    name: "query_data",
    label: "数据查询与聚合",
    args: {
      metric: spec.metric,
      dim: spec.dim,
      agg: spec.agg,
      granularity: spec.granularity,
      lastDays: spec.lastDays,
      period: spec.period,
      year: spec.year,
      filters: spec.filters,
      seriesValues: spec.seriesValues,
      limit: spec.limit,
    },
  };
  await sleep(model === "pro" ? 460 : 220);
  const res = queryData(ds, spec);
  yield {
    type: "tool_result",
    id: callId,
    ok: true,
    summary: `按${spec.dim}聚合「${spec.metric}」，共 ${res.stats.n} 个数据点，总计 ${res.stats.total}`,
    metrics: res.metrics,
    table: res.table,
  };

  // 4.4 智能图表推荐
  const chartId = rid("tool-");
  yield {
    type: "tool_call",
    id: chartId,
    name: "recommend_chart",
    label: "智能图表推荐",
    args: { intent: spec.intent },
  };
  await sleep(220);
  yield {
    type: "tool_result",
    id: chartId,
    ok: true,
    summary: `基于数据形态推荐${spec.intent === "distribution" ? "环形图" : spec.intent === "ranking" ? "水平条形图" : "折线图"}`,
    chart: chartFromResult(spec, res, isDateDim),
  };

  // 4.5 异常检测附加工具
  if (intent === "anomaly") {
    const aId = rid("tool-");
    yield {
      type: "tool_call",
      id: aId,
      name: "detect_anomaly",
      label: "异常检测（Z-Score）",
      args: { metric: spec.metric, lastDays: spec.lastDays },
    };
    await sleep(360);
    const anomalies = detectAnomalies(res);
    yield {
      type: "tool_result",
      id: aId,
      ok: true,
      summary: anomalies.length ? `检测到 ${anomalies.length} 个异常点` : "未检测到显著异常点",
    };
  }

  // 4.6 预测附加工具
  if (intent === "forecast") {
    const fId = rid("tool-");
    yield {
      type: "tool_call",
      id: fId,
      name: "forecast",
      label: "线性趋势预测",
      args: { metric: spec.metric, lastDays: spec.lastDays, steps: 7 },
    };
    await sleep(420);
    const fc = forecastSeries(res, 7);
    if (fc) {
      yield {
        type: "tool_result",
        id: fId,
        ok: true,
        summary: `斜率 ${fc.slope}，未来 7 期预计 ${fc.projected}`,
        chart: {
          type: "line",
          title: `「${spec.metric}」趋势预测（演示） · ${res.stats.rangeLabel}`,
          xLabel: "时间",
          yLabel: spec.metric,
          series: fc.series,
          forecast: true,
        },
      };
    } else {
      yield { type: "tool_result", id: fId, ok: false, summary: "数据点不足，无法可靠预测" };
    }
  }

  // 4.7 流式洞察文本
  await sleep(160);
  let text: string;
  try {
    text = composeInsight(ds, spec, res);
  } catch {
    text = FALLBACK_REPLY;
  }
  for await (const d of streamText(text, model)) yield { type: "text", delta: d };

  yield {
    type: "usage",
    promptTokens: q.length + 300 + ds.rows.length,
    completionTokens: text.length,
    toolCalls: intent === "anomaly" || intent === "forecast" ? 3 : 2,
    latencyMs: Date.now() - t0,
  };
  yield { type: "done", ok: true };
}

/** 相关性分析路径使用的空结果（文本中会重新计算相关系数） */
function emptyResult(spec: ReturnType<typeof parseQuery>) {
  return {
    series: [{ name: spec.metric, points: [] }],
    table: { columns: [], rows: [] },
    metrics: [],
    stats: {
      total: 0,
      avg: 0,
      peak: { label: "-", value: 0 },
      low: { label: "-", value: 0 },
      n: 0,
      prevTotal: null,
      changePct: null,
      rangeLabel: "全部周期",
    },
    xKeys: [],
    xIsDate: false,
    counts: [],
  };
}

/** 意图待澄清时的引导语（前端配合推荐问题使用） */
export function clarifyReply(datasetName: string): string {
  return `我可以从趋势、占比、排名、对比、相关性、异常、预测等角度分析《${datasetName}》。\n\n例如：\n· 「近30天核心指标的趋势如何？」\n· 「各维度占比是多少？」\n· 「对比两个维度取值的表现」\n· 「生成一份洞察报告」`;
}
