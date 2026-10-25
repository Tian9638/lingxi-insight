/**
 * CSV 上传解析与列类型推断（客户端执行）
 */

import Papa from "papaparse";
import type { Column, ColumnType, Dataset } from "../types";
import { rid } from "../utils";

const NUM_RE = /^-?\d+(\.\d+)?$/;
const DATE_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;

function inferType(values: string[]): ColumnType {
  const sample = values.filter((v) => v !== "" && v != null).slice(0, 50);
  if (sample.length === 0) return "string";
  if (sample.every((v) => NUM_RE.test(v.trim()))) return "number";
  if (sample.every((v) => DATE_RE.test(v.trim()))) return "date";
  return "string";
}

function coerce(value: string, type: ColumnType): string | number {
  if (value == null) return "";
  const v = String(value).trim();
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  if (type === "date") {
    // 归一化为 YYYY-MM-DD
    const m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return v;
}

/** 解析 CSV 文件为 Dataset（行数上限 5000，防止超大文件拖垮浏览器） */
export async function parseCsvFile(file: File): Promise<Dataset> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const fields = (result.meta.fields ?? []).filter(Boolean);
          if (fields.length === 0 || result.data.length === 0) {
            reject(new Error("CSV 解析失败：未识别到表头或数据行"));
            return;
          }
          const columns: Column[] = fields.map((name) => ({
            name,
            type: inferType(result.data.map((r) => r[name])),
          }));
          const rows = result.data.slice(0, 5000).map((r) => {
            const out: Record<string, string | number> = {};
            for (const col of columns) out[col.name] = coerce(r[col.name], col.type);
            return out;
          });
          resolve({
            id: rid("ds-"),
            name: file.name.replace(/\.(csv|tsv|txt)$/i, "") || "上传数据集",
            source: "upload",
            createdAt: Date.now(),
            columns,
            rows,
          });
        } catch (err) {
          reject(err);
        }
      },
      error: (err: Error) => reject(new Error(`CSV 解析失败：${err.message}`)),
    });
  });
}
