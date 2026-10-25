/**
 * 自然语言理解层：意图识别 + 查询规格解析
 * 将中文自然语言问题解析为结构化的 QuerySpec（指标 / 维度 / 聚合方式 / 时间范围 / 过滤条件）
 */

import type { DatasetPayload } from "../types";
import type { Agg, Granularity, Intent, QuerySpec } from "./dataops";

export type { Intent };

/** 指标同义词（问题中的口语 -> 标准列名） */
const METRIC_SYNONYMS: Record<string, string[]> = {
  销售额: ["销售额", "销售", "营收", "收入", "gmv", "GMV", "营业额", "流水"],
  订单量: ["订单量", "订单", "单量", "成交量"],
  客单价: ["客单价", "平均客单"],
  PM25: ["pm2.5", "pm25", "细颗粒物", "细颗粒"],
  PM10: ["pm10", "可吸入颗粒物", "粗颗粒物"],
  AQI: ["aqi", "空气质量指数", "空气指数"],
  学习时长: ["学习时长", "学习时间", "学时", "学习投入"],
  测验得分: ["测验得分", "得分", "成绩", "分数", "测验成绩"],
  完成率: ["完成率", "完成比例", "完成度"],
};

/** 维度同义词 */
const DIM_SYNONYMS: Record<string, string[]> = {
  品类: ["品类", "类别", "分类", "类目"],
  渠道: ["渠道", "平台", "端口", "入口"],
  地区: ["地区", "区域", "地域"],
  城市: ["城市", "都市"],
  首要污染物: ["首要污染物", "污染物", "主要污染物"],
  学科: ["学科", "科目", "课程"],
};

/** 基于规则 + 关键词的意图识别（按优先级顺序匹配） */
export function classifyIntent(q: string): Intent {
  const s = q.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => s.includes(k));
  if (has("预测", "未来", "展望", "预计", "将会")) return "forecast";
  if (has("报告", "总结", "洞察", "全面分析", "分析报告", "复盘")) return "report";
  if (has("异常", "波动", "突增", "突降", "奇怪", "离群", "不正常")) return "anomaly";
  if (has("相关", "关系", "影响")) return "correlation";
  if (has("对比", "比较", "相比", " versus ", " vs ", "vs.", "哪个更")) return "compare";
  if (has("排名", "排行", "top", "最高", "最低", "前几", "榜首", "冠军", "最好", "最差"))
    return "ranking";
  if (has("占比", "比例", "分布", "构成", "多少", "份额")) return "distribution";
  if (has("趋势", "走势", "变化", "增长", "下降", "上升", "涨", "跌", "如何", "怎样", "怎么样"))
    return "trend";
  if (has("你好", "您好", "hi", "hello", "在吗", "你是谁", "你能做什么", "帮助", "功能"))
    return "greeting";
  return "unclear";
}

/** 从问题中解析出结构化查询规格 */
export function parseQuery(q: string, ds: DatasetPayload, intent: Intent): QuerySpec {
  const dateCol = ds.columns.find((c) => c.type === "date")?.name;
  const numCols = ds.columns.filter((c) => c.type === "number").map((c) => c.name);
  const strCols = ds.columns.filter((c) => c.type === "string").map((c) => c.name);
  const lower = q.toLowerCase();

  // ---- 1. 指标解析 ----
  let metric = numCols.find((c) => q.includes(c));
  if (!metric) {
    for (const [std, syns] of Object.entries(METRIC_SYNONYMS)) {
      if (numCols.includes(std) && syns.some((s) => lower.includes(s.toLowerCase()))) {
        metric = std;
        break;
      }
    }
  }
  if (!metric) metric = numCols[0] ?? "记录数";

  // 相关性分析需要两个指标
  let metric2: string | undefined;
  if (intent === "correlation") {
    const matched = numCols.filter((c) => q.includes(c));
    if (matched.length >= 2) {
      metric = matched[0];
      metric2 = matched[1];
    } else {
      metric2 = numCols.find((c) => c !== metric);
    }
  }

  // ---- 2. 维度解析 ----
  let dim: string | undefined = strCols.find((c) => q.includes(c));
  if (!dim) {
    for (const [std, syns] of Object.entries(DIM_SYNONYMS)) {
      if (strCols.includes(std) && syns.some((s) => q.includes(s))) {
        dim = std;
        break;
      }
    }
  }

  // ---- 3. 时间范围解析 ----
  let lastDays: number | undefined;
  let period: "this" | "last" | "year" | undefined;
  let year: number | undefined;
  const mDays = q.match(/(?:最近|近)\s*(\d+)\s*天/);
  const mWeek = q.match(/(?:最近|近)\s*(\d+)\s*(?:周|个?星期)/);
  const mMonth = q.match(/(?:最近|近)\s*(\d+)\s*(?:个?月)/);
  if (mDays) lastDays = Number(mDays[1]);
  else if (mWeek) lastDays = Number(mWeek[1]) * 7;
  else if (mMonth) lastDays = Number(mMonth[1]) * 30;
  const mYear = q.match(/(\d{4})\s*年/);
  if (mYear) year = Number(mYear[1]);
  if (/本月|这个月|当月|本周|这周/.test(q) && !lastDays && !year) period = "this";
  if (/上月|上个月/.test(q)) period = "last";
  if (/今年|全年|本年度|年度/.test(q) && !year) period = "year";
  if (/最近|近期|以来|这段时间/.test(q) && !lastDays && !period && !year) lastDays = 30;

  // ---- 4. 时间粒度 ----
  let granularity: Granularity = "none";
  if (/每周|按周|各周|周度/.test(q)) granularity = "week";
  else if (/每月|按月|各月|月度/.test(q)) granularity = "month";
  else if (/每天|按天|每日|各天|日度/.test(q)) granularity = "day";

  // ---- 5. 聚合方式 ----
  let agg: Agg = "sum";
  if (/平均|均值|人均|日均|平均水平/.test(q)) agg = "avg";
  if (/最大|峰值|峰值时段/.test(q)) agg = "max";
  if (/最小|最低值/.test(q)) agg = "min";

  // ---- 6. 维度取值匹配（过滤 / 对比） ----
  const filters: { column: string; values: string[] }[] = [];
  let seriesDim: string | undefined;
  let seriesValues: string[] | undefined;
  for (const col of strCols) {
    const values = [...new Set(ds.rows.map((r) => String(r[col])))] as string[];
    const hits = values.filter(
      (v) => q.includes(v) || (v.length >= 3 && q.includes(v.slice(0, 2)))
    );
    if (hits.length === 0) continue;
    if (intent === "compare" && hits.length >= 2) {
      seriesDim = col;
      seriesValues = hits.slice(0, 2);
    } else {
      filters.push({ column: col, values: hits });
      if (!dim) dim = col;
    }
  }

  // ---- 7. Top N ----
  let limit: number | undefined;
  const mLim = q.match(/前\s*(\d+)|top\s*(\d+)|(\d+)\s*(?:个|名|条|大)/i);
  if (mLim) limit = Number(mLim[1] || mLim[2] || mLim[3]);
  else if (intent === "ranking") limit = 5;

  // ---- 8. 维度兜底 ----
  if (!dim) {
    if (intent === "trend" || intent === "forecast" || intent === "anomaly" || intent === "report") {
      dim = dateCol ?? strCols[0] ?? numCols[0];
    } else {
      dim = strCols[0] ?? dateCol ?? numCols[0];
    }
  }

  // X 轴粒度兜底：时间维度且未指定粒度时按天
  if (dim === dateCol && granularity === "none") granularity = "day";

  return {
    metric,
    metric2,
    dim,
    seriesDim,
    seriesValues,
    agg,
    granularity,
    lastDays,
    period,
    year,
    filters,
    limit,
    intent,
  };
}
