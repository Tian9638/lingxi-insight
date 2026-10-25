"use client";

/**
 * 纯 SVG 图表引擎（零图表库依赖）
 * 支持：折线（含预测虚线 / 异常标注）、柱状、水平条形、环形、散点
 * 特性：入场动画、坐标轴刻度、原生 tooltip、响应式宽度
 */

import { useId } from "react";
import type { ChartSpec } from "@/lib/types";
import { fmtTick } from "@/lib/utils";

const SERIES_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

const W = 640;
const H = 300;

function EmptyChart() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
      暂无可用数据
    </div>
  );
}

/** 计算「好看」的 Y 轴范围与刻度 */
function niceScale(min: number, max: number, ticks = 5) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / ticks)));
  const err = (span / ticks) / step;
  const mult = err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1;
  const niceStep = mult * step;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const values: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep / 2; v += niceStep) values.push(v);
  return { min: niceMin, max: niceMax, values };
}

// ---------- 折线图 ----------

function LineChart({ spec }: { spec: ChartSpec }) {
  const gid = useId().replace(/:/g, "");
  const n = Math.max(...spec.series.map((s) => s.points.length), 0);
  if (n === 0) return <EmptyChart />;

  const padL = 56;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const values = spec.series.flatMap((s) => s.points.map((p) => p.y));
  const scale = niceScale(Math.min(...values), Math.max(...values));
  const x = (i: number) =>
    n === 1 ? padL + (W - padL - padR) / 2 : padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v: number) =>
    padT + (1 - (v - scale.min) / (scale.max - scale.min || 1)) * (H - padT - padB);

  const labelStep = Math.max(1, Math.ceil(n / 8));
  const firstSeries = spec.series[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={spec.title}>
      <defs>
        {spec.series.map((_, si) => (
          <linearGradient key={si} id={`area-${gid}-${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[si % SERIES_COLORS.length]} stopOpacity="0.22" />
            <stop offset="100%" stopColor={SERIES_COLORS[si % SERIES_COLORS.length]} stopOpacity="0.01" />
          </linearGradient>
        ))}
      </defs>

      {/* 网格与 Y 轴刻度 */}
      {scale.values.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray={v === 0 ? undefined : "3 4"}
          />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
            {fmtTick(v)}
          </text>
        </g>
      ))}

      {/* X 轴标签 */}
      {firstSeries.points.map((p, i) =>
        i % labelStep === 0 || i === n - 1 ? (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            className="fill-slate-400 text-[11px]"
          >
            {p.x}
          </text>
        ) : null
      )}

      {/* 面积填充（仅单序列实线） */}
      {spec.series.length === 1 && !spec.series[0].dashed && (
        <path
          d={`M ${x(0)} ${y(firstSeries.points[0].y)} ${firstSeries.points
            .map((p, i) => `L ${x(i)} ${y(p.y)}`)
            .join(" ")} L ${x(n - 1)} ${H - padB} L ${x(0)} ${H - padB} Z`}
          fill={`url(#area-${gid}-0)`}
        />
      )}

      {/* 折线 */}
      {spec.series.map((s, si) => (
        <path
          key={si}
          d={`M ${s.points.map((p, i) => `${x(i)} ${y(p.y)}`).join(" L ")}`}
          fill="none"
          stroke={SERIES_COLORS[si % SERIES_COLORS.length]}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.dashed ? "7 6" : undefined}
          className={s.dashed ? undefined : "chart-line-anim"}
          pathLength={1}
        />
      ))}

      {/* 数据点（异常标注 + 悬停） */}
      {spec.series.map((s, si) =>
        s.points.map((p, i) => (
          <g key={`${si}-${i}`}>
            {p.flag === "anomaly" && (
              <>
                <circle cx={x(i)} cy={y(p.y)} r="7" fill="#ef4444" opacity="0.18">
                  <animate attributeName="r" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <circle cx={x(i)} cy={y(p.y)} r="4" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
              </>
            )}
            <circle cx={x(i)} cy={y(p.y)} r="11" fill="transparent">
              <title>{`${p.x} · ${spec.series[si].name}：${fmtTick(p.y)}`}</title>
            </circle>
          </g>
        ))
      )}
    </svg>
  );
}

// ---------- 垂直柱状图 ----------

function BarChart({ spec }: { spec: ChartSpec }) {
  const gid = useId().replace(/:/g, "");
  const pts = spec.series[0].points;
  if (pts.length === 0) return <EmptyChart />;
  const padL = 56;
  const padR = 18;
  const padT = 22;
  const padB = 34;
  const values = pts.map((p) => p.y);
  const scale = niceScale(0, Math.max(...values));
  const y = (v: number) =>
    padT + (1 - (v - scale.min) / (scale.max - scale.min || 1)) * (H - padT - padB);
  const band = (W - padL - padR) / pts.length;
  const barW = Math.min(46, band * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={spec.title}>
      <defs>
        <linearGradient id={`bar-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      {scale.values.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="3 4" />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
            {fmtTick(v)}
          </text>
        </g>
      ))}
      {pts.map((p, i) => {
        const bx = padL + i * band + (band - barW) / 2;
        const by = y(p.y);
        return (
          <g key={i}>
            <rect
              x={bx}
              y={by}
              width={barW}
              height={Math.max(1, H - padB - by)}
              rx="5"
              fill={`url(#bar-${gid})`}
              className="bar-anim-y"
              style={{ animationDelay: `${i * 60}ms` }}
            />
            <text x={bx + barW / 2} y={H - 12} textAnchor="middle" className="fill-slate-400 text-[11px]">
              {p.x.length > 5 ? p.x.slice(0, 5) + "…" : p.x}
            </text>
            <rect x={padL + i * band} y={padT} width={band} height={H - padT - padB} fill="transparent">
              <title>{`${p.x}：${fmtTick(p.y)}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- 水平条形图（排名） ----------

function HBarChart({ spec }: { spec: ChartSpec }) {
  const gid = useId().replace(/:/g, "");
  const pts = spec.series[0].points;
  if (pts.length === 0) return <EmptyChart />;
  const labelW = 104;
  const padR = 92;
  const padT = 12;
  const rowH = Math.min(40, (H - padT * 2) / pts.length);
  const max = Math.max(...pts.map((p) => p.y));
  const barMax = W - labelW - padR;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={spec.title}>
      <defs>
        <linearGradient id={`hbar-${gid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      {pts.map((p, i) => {
        const y = padT + i * rowH;
        const bw = Math.max(2, (p.y / (max || 1)) * barMax);
        return (
          <g key={i}>
            <text
              x={labelW - 10}
              y={y + rowH / 2 + 4}
              textAnchor="end"
              className="fill-slate-600 text-[12px]"
            >
              {p.x.length > 7 ? p.x.slice(0, 7) + "…" : p.x}
            </text>
            <rect
              x={labelW}
              y={y + rowH * 0.22}
              width={bw}
              height={rowH * 0.56}
              rx="5"
              fill={`url(#hbar-${gid})`}
              className="bar-anim-x"
              style={{ animationDelay: `${i * 70}ms` }}
            />
            <text
              x={labelW + bw + 8}
              y={y + rowH / 2 + 4}
              className="fill-slate-700 text-[12px] font-medium"
            >
              {fmtTick(p.y)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- 环形图（占比） ----------

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p0 = polar(cx, cy, rOuter, a0);
  const p1 = polar(cx, cy, rOuter, a1);
  const p2 = polar(cx, cy, rInner, a1);
  const p3 = polar(cx, cy, rInner, a0);
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

function DonutChart({ spec }: { spec: ChartSpec }) {
  const pts = spec.series[0].points;
  if (pts.length === 0) return <EmptyChart />;
  const total = pts.reduce((s, p) => s + p.y, 0) || 1;
  const cx = 200;
  const cy = 150;
  const rOuter = 108;
  const rInner = 68;

  let angle = 0;
  const arcs = pts.map((p, i) => {
    const sweep = (p.y / total) * 360;
    const path = arcPath(cx, cy, rOuter, rInner, angle, angle + Math.max(sweep, 0.6));
    angle += sweep;
    return { path, color: SERIES_COLORS[i % SERIES_COLORS.length], p };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={spec.title}>
      {arcs.map((a, i) => (
        <path
          key={i}
          d={a.path}
          fill={a.color}
          className="donut-anim"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <title>{`${a.p.x}：${fmtTick(a.p.y)}（${((a.p.y / total) * 100).toFixed(1)}%）`}</title>
        </path>
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-900 text-[22px] font-bold">
        {fmtTick(total)}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-400 text-[11px]">
        总计
      </text>

      {/* 图例 */}
      {pts.slice(0, 8).map((p, i) => (
        <g key={i} transform={`translate(408, ${34 + i * 26})`}>
          <rect width="10" height="10" rx="3" fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          <text x="16" y="9" className="fill-slate-600 text-[12px]">
            {p.x.length > 8 ? p.x.slice(0, 8) + "…" : p.x}
          </text>
          <text x="218" y="9" textAnchor="end" className="fill-slate-400 text-[12px]">
            {((p.y / total) * 100).toFixed(1)}%
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------- 散点图（相关性） ----------

function ScatterChart({ spec }: { spec: ChartSpec }) {
  const pts = spec.series[0].points;
  if (pts.length === 0) return <EmptyChart />;
  const padL = 56;
  const padR = 18;
  const padT = 18;
  const padB = 36;
  const xs = pts.map((p) => p.nx ?? 0);
  const ys = pts.map((p) => p.y);
  const sx = niceScale(Math.min(...xs), Math.max(...xs));
  const sy = niceScale(Math.min(...ys), Math.max(...ys));
  const x = (v: number) => padL + ((v - sx.min) / (sx.max - sx.min || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - sy.min) / (sy.max - sy.min || 1)) * (H - padT - padB);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={spec.title}>
      {sy.values.map((v) => (
        <g key={`y${v}`}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="3 4" />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
            {fmtTick(v)}
          </text>
        </g>
      ))}
      {sx.values.map((v) => (
        <text key={`x${v}`} x={x(v)} y={H - 14} textAnchor="middle" className="fill-slate-400 text-[11px]">
          {fmtTick(v)}
        </text>
      ))}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={x(p.nx ?? 0)}
          cy={y(p.y)}
          r="4.5"
          fill="#6366f1"
          opacity="0.55"
          className="donut-anim"
          style={{ animationDelay: `${Math.min(i * 6, 600)}ms` }}
        >
          <title>{`${spec.xLabel} ${fmtTick(p.nx ?? 0)} · ${spec.yLabel} ${fmtTick(p.y)}`}</title>
        </circle>
      ))}
      <text x={W - padR} y={H - 2} textAnchor="end" className="fill-slate-400 text-[11px]">
        {spec.xLabel}
      </text>
    </svg>
  );
}

// ---------- 入口 ----------

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  switch (spec.type) {
    case "line":
      return <LineChart spec={spec} />;
    case "bar":
      return <BarChart spec={spec} />;
    case "hbar":
      return <HBarChart spec={spec} />;
    case "donut":
      return <DonutChart spec={spec} />;
    case "scatter":
      return <ScatterChart spec={spec} />;
    default:
      return <EmptyChart />;
  }
}

export { SERIES_COLORS };
