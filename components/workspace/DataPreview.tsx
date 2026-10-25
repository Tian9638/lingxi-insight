"use client";

/**
 * 数据预览：当前数据集的原始数据表格（前 50 行）
 */

import { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { useStore } from "@/lib/store";

export function DataPreview() {
  const [limit] = useState(50);
  const { datasets, activeDatasetId } = useStore();
  const ds = datasets.find((d) => d.id === activeDatasetId);
  const rows = useMemo(() => (ds ? ds.rows.slice(0, limit) : []), [ds, limit]);

  if (!ds) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-400">
        <Table2 className="mb-2 h-8 w-8" />
        <p className="text-xs">暂无数据集</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Table2 className="h-4 w-4 text-brand-500" />
          数据预览
        </h3>
        <span className="text-[11px] text-slate-400">
          {ds.name} · 前 {Math.min(limit, ds.rows.length)} / {ds.rows.length} 行
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {ds.columns.map((c) => (
                <th
                  key={c.name}
                  className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold text-slate-600"
                >
                  {c.name}
                  <span className="ml-1 text-[9px] font-normal text-slate-400">
                    {c.type === "number" ? "数值" : c.type === "date" ? "日期" : "类别"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-brand-50/40">
                {ds.columns.map((c) => (
                  <td
                    key={c.name}
                    className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5 text-slate-600"
                  >
                    {typeof r[c.name] === "number"
                      ? (r[c.name] as number).toLocaleString("zh-CN")
                      : String(r[c.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
