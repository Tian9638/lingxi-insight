import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 类名合并工具 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 生成短随机 ID */
export function rid(prefix = "") {
  return (
    prefix +
    Math.random().toString(36).slice(2, 8) +
    Date.now().toString(36).slice(-4)
  );
}

// ---------- 日期工具（全程使用本地时间，避免时区偏移） ----------

export function parseDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export function toDateStr(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseDate(s);
  const dt = new Date(y, m - 1, d + n);
  return toDateStr(dt);
}

export function daysBetween(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  const da = new Date(pa.y, pa.m - 1, pa.d).getTime();
  const db = new Date(pb.y, pb.m - 1, pb.d).getTime();
  return Math.round((db - da) / 86400000);
}

/** 周一为一周起点 */
export function weekStart(s: string): string {
  const { y, m, d } = parseDate(s);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  return toDateStr(dt);
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

/** '2026-05-03' -> '5月3日' */
export function fmtDayLabel(s: string): string {
  const { m, d } = parseDate(s);
  return `${m}月${d}日`;
}

/** 周一日期 -> '5/3周' */
export function fmtWeekLabel(s: string): string {
  const { m, d } = parseDate(s);
  return `${m}/${d}周`;
}

/** '2026-05' -> '5月' */
export function fmtMonthLabel(s: string): string {
  return `${Number(s.slice(5, 7))}月`;
}

// ---------- 数字格式化 ----------

export function fmtInt(v: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(v);
}

/** 智能货币格式：¥8,600 / ¥12.3万 / ¥1.24亿 */
export function fmtMoney(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `¥${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `¥${(v / 1e4).toFixed(1)}万`;
  return `¥${fmtInt(Math.round(v))}`;
}

/** 智能数值格式（自动加万/亿） */
export function fmtNum(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
  return fmtInt(Math.round(v * 100) / 100);
}

/** 根据指标名推断格式：金额类 -> 货币，其余 -> 智能数值 */
export function fmtMetric(metric: string, v: number): string {
  if (/额|金额|价|收入|营收|gmv|GMV|销售/.test(metric)) return fmtMoney(v);
  if (/率|占比|百分比/.test(metric)) return `${(v * 100).toFixed(1)}%`;
  return fmtNum(v);
}

export function fmtPct(v: number, withSign = true): string {
  const s = withSign && v > 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}

/** 图表坐标轴用的紧凑刻度 */
export function fmtTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(1)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  if (abs >= 1000) return fmtInt(v);
  return String(Math.round(v * 10) / 10);
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
