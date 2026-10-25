/**
 * 内置示例数据集（确定性生成：固定随机种子，保证每次加载数据一致）
 * 数据为合成数据，仅用于产品演示与评审。
 */

import type { Dataset } from "../types";
import { toDateStr } from "../utils";

/** mulberry32 伪随机数生成器（种子固定 => 结果确定） */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 从基准日期生成连续日期序列 */
function dateSeries(start: string, n: number): string[] {
  const [y, m, d] = start.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: n }, (_, i) => toDateStr(new Date(base.getTime() + i * 86400000)));
}

// ---------- 数据集一：电商销售明细 ----------

function buildEcommerce(): Dataset {
  const rnd = mulberry32(20261025);
  const dates = dateSeries("2026-05-01", 90);
  const categories = [
    { name: "数码家电", base: 52000, price: 780 },
    { name: "服饰美妆", base: 34000, price: 240 },
    { name: "家居生活", base: 21000, price: 150 },
  ];
  const regions = ["华北", "华东", "华南", "西部"];
  const channels = ["小程序商城", "App", "网页端"];
  const rows: Record<string, string | number>[] = [];

  dates.forEach((date, i) => {
    const dow = new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10))
    ).getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.18 : 1;
    const growth = 1 + i * 0.0016; // 缓慢增长趋势
    categories.forEach((cat) => {
      const noise = 0.85 + rnd() * 0.3;
      const sales = Math.round(cat.base * weekendBoost * growth * noise);
      const orders = Math.max(20, Math.round(sales / (cat.price * (0.9 + rnd() * 0.2))));
      rows.push({
        日期: date,
        品类: cat.name,
        渠道: channels[Math.floor(rnd() * channels.length)],
        地区: regions[Math.floor(rnd() * regions.length)],
        销售额: sales,
        订单量: orders,
        客单价: Math.round(sales / orders),
      });
    });
  });

  return {
    id: "ds-ecommerce",
    name: "电商销售明细",
    source: "sample",
    createdAt: 0,
    columns: [
      { name: "日期", type: "date" },
      { name: "品类", type: "string" },
      { name: "渠道", type: "string" },
      { name: "地区", type: "string" },
      { name: "销售额", type: "number" },
      { name: "订单量", type: "number" },
      { name: "客单价", type: "number" },
    ],
    rows,
  };
}

// ---------- 数据集二：城市空气质量监测 ----------

function buildAirQuality(): Dataset {
  const rnd = mulberry32(770321);
  const dates = dateSeries("2026-08-01", 90);
  const cities = [
    { name: "北京", pm25: 46 },
    { name: "成都", pm25: 43 },
    { name: "上海", pm25: 37 },
    { name: "广州", pm25: 29 },
  ];
  const rows: Record<string, string | number>[] = [];

  dates.forEach((date, i) => {
    // 秋冬季节污染加重
    const month = Number(date.slice(5, 7));
    const season = month >= 10 ? 1.3 : month >= 8 ? 1.05 : 0.9;
    cities.forEach((city) => {
      const pm25 = Math.max(6, Math.round(city.pm25 * season * (0.75 + rnd() * 0.5)));
      const pm10 = Math.round(pm25 * (1.6 + rnd() * 0.5));
      const aqi = Math.round(pm25 * 1.7 + pm10 * 0.35);
      rows.push({
        日期: date,
        城市: city.name,
        PM25: pm25,
        PM10: pm10,
        AQI: aqi,
        首要污染物: pm25 >= pm10 ? "PM2.5" : "PM10",
      });
    });
  });

  return {
    id: "ds-air",
    name: "城市空气质量监测",
    source: "sample",
    createdAt: 0,
    columns: [
      { name: "日期", type: "date" },
      { name: "城市", type: "string" },
      { name: "PM25", type: "number" },
      { name: "PM10", type: "number" },
      { name: "AQI", type: "number" },
      { name: "首要污染物", type: "string" },
    ],
    rows,
  };
}

// ---------- 数据集三：高校学生学习行为 ----------

function buildStudy(): Dataset {
  const rnd = mulberry32(112358);
  const subjects = ["高等数学", "程序设计", "大学英语", "数据结构"];
  const rows: Record<string, string | number>[] = [];

  for (let week = 1; week <= 16; week++) {
    subjects.forEach((subject, si) => {
      const base = [7.5, 6.8, 5.2, 6.2][si];
      const decay = 1 - (week - 1) * 0.012; // 学期后段投入缓慢下降
      const hours = Math.round(base * decay * (0.85 + rnd() * 0.3) * 10) / 10;
      const score = Math.round(68 + hours * 2.1 + (rnd() - 0.5) * 10);
      rows.push({
        周次: week,
        学科: subject,
        学习时长: hours,
        测验得分: Math.min(98, Math.max(52, score)),
        完成率: Math.round((0.62 + rnd() * 0.35) * 100) / 100,
      });
    });
  }

  return {
    id: "ds-study",
    name: "高校学生学习行为",
    source: "sample",
    createdAt: 0,
    columns: [
      { name: "周次", type: "number" },
      { name: "学科", type: "string" },
      { name: "学习时长", type: "number" },
      { name: "测验得分", type: "number" },
      { name: "完成率", type: "number" },
    ],
    rows,
  };
}

// ---------- 数据集四：县域乡村振兴监测（社会价值主题） ----------
/**
 * 面向公共服务场景的合成数据：用于展示「AI 分析如何服务县域治理与共同富裕」。
 * 指标设计参考乡村振兴监测常见维度（收入、教育、医疗、产业、人才回流）。
 */
function buildRural(): Dataset {
  const rnd = mulberry32(20241108);
  const counties = [
    { name: "云岭县", base: 12800, ecom: 2400, industry: 5200 },
    { name: "青山县", base: 15200, ecom: 3600, industry: 6800 },
    { name: "河源县", base: 11600, ecom: 1800, industry: 4300 },
    { name: "平畴县", base: 17400, ecom: 5100, industry: 8600 },
    { name: "石门县", base: 13900, ecom: 2900, industry: 5900 },
    { name: "望川县", base: 12100, ecom: 2100, industry: 4700 },
  ];
  // 2024Q1 - 2025Q4 共 8 个季度（以季度首日表示，便于趋势/同比分析）
  const quarters = [
    "2024-01-01", "2024-04-01", "2024-07-01", "2024-10-01",
    "2025-01-01", "2025-04-01", "2025-07-01", "2025-10-01",
  ];
  const rows: Record<string, string | number>[] = [];

  quarters.forEach((q, qi) => {
    counties.forEach((c) => {
      const growth = 1 + qi * 0.021; // 收入逐季稳步增长
      const noise = 0.95 + rnd() * 0.1;
      const income = Math.round(c.base * growth * noise);
      const ecom = Math.round(c.ecom * (1 + qi * 0.055) * (0.9 + rnd() * 0.25));
      const industry = Math.round(c.industry * (1 + qi * 0.038) * (0.92 + rnd() * 0.2));
      // 义务教育巩固率 / 村卫生室覆盖率：比率型指标，随时间改善
      const school = Math.min(0.998, 0.905 + qi * 0.006 + rnd() * 0.012);
      const clinic = Math.min(0.998, 0.78 + qi * 0.021 + rnd() * 0.02);
      const startup = Math.round(28 + qi * 3.4 + rnd() * 12); // 季度返乡创业新增

      rows.push({
        季度: q,
        县区: c.name,
        人均可支配收入: income,
        义务教育巩固率: Math.round(school * 1000) / 1000,
        村卫生室覆盖率: Math.round(clinic * 1000) / 1000,
        电商交易额: ecom,
        特色产业产值: industry,
        返乡创业人数: startup,
      });
    });
  });

  return {
    id: "ds-rural",
    name: "县域乡村振兴监测",
    source: "sample",
    createdAt: 0,
    columns: [
      { name: "季度", type: "date" },
      { name: "县区", type: "string" },
      { name: "人均可支配收入", type: "number" },
      { name: "义务教育巩固率", type: "number" },
      { name: "村卫生室覆盖率", type: "number" },
      { name: "电商交易额", type: "number" },
      { name: "特色产业产值", type: "number" },
      { name: "返乡创业人数", type: "number" },
    ],
    rows,
  };
}

let cache: Dataset[] | null = null;

/** 获取内置数据集（模块级缓存，保证引用稳定） */
export function getSampleDatasets(): Dataset[] {
  if (!cache) {
    cache = [buildEcommerce(), buildAirQuality(), buildStudy(), buildRural()];
  }
  return cache;
}

/** 每个数据集对应的推荐问题（用于空状态与澄清引导） */
export const SUGGESTIONS: Record<string, string[]> = {
  "ds-ecommerce": [
    "近30天销售额的趋势如何？",
    "各品类销售额占比是多少？",
    "对比小程序商城和App的订单量",
    "销售额最高的5个品类",
    "预测未来7天销售额",
    "生成一份销售洞察报告",
  ],
  "ds-air": [
    "各城市AQI的对比",
    "北京PM2.5的月度趋势",
    "哪种首要污染物占比最高？",
    "PM2.5和PM10相关性如何？",
    "最近90天有哪些异常波动？",
  ],
  "ds-study": [
    "各学科学习时长排名",
    "学习时长和测验得分相关性如何？",
    "每周学习时长趋势",
    "完成率的分布情况",
    "生成一份学情分析报告",
  ],
  "ds-rural": [
    "各县区人均可支配收入排名",
    "人均可支配收入的季度趋势",
    "电商交易额和人均可支配收入相关性如何？",
    "村卫生室覆盖率提升最快的是哪个县？",
    "各县区义务教育巩固率对比",
    "生成一份乡村振兴监测报告",
  ],
};
