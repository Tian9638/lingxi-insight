/**
 * RAG 轻量检索模块：文档切片 + TF-IDF 向量化 + 余弦相似度检索
 * 纯本地算法实现，无需外部向量服务；接口与真实 Embedding 检索对齐，
 * 可在同一接口下替换为向量数据库（见 README「技术架构」）。
 */

import type { Citation, KnowledgeDocPayload } from "../types";

export interface Chunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
}

/** 按句子边界滑动窗口切片（保留重叠，避免语义截断） */
export function chunkText(text: string, size = 160, overlap = 40): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    // 尽量在标点处断开
    if (end < clean.length) {
      const win = clean.slice(start, end);
      const lastPunct = Math.max(win.lastIndexOf("。"), win.lastIndexOf("；"), win.lastIndexOf("\n"), win.lastIndexOf("！"));
      if (lastPunct > size * 0.5) end = start + lastPunct + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

/** 中文按二元组 + 英文按词的分词（兼顾中英文检索） */
export function tokenize(s: string): string[] {
  const tokens: string[] = [];
  const words = s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  tokens.push(...words);
  const han = s.match(/[\u4e00-\u9fa5]/g) ?? [];
  for (let i = 0; i < han.length; i++) {
    tokens.push(han[i]);
    if (i + 1 < han.length) tokens.push(han[i] + han[i + 1]);
  }
  return tokens;
}

/** TF-IDF 余弦相似度检索 */
export function retrieve(
  query: string,
  chunks: Chunk[],
  topK = 3
): { chunk: Chunk; score: number }[] {
  if (chunks.length === 0) return [];
  const dfs = new Map<string, number>();
  const chunkTokens = chunks.map((c) => {
    const tf = new Map<string, number>();
    for (const t of tokenize(c.text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) dfs.set(t, (dfs.get(t) ?? 0) + 1);
    return tf;
  });
  const idf = (t: string) => Math.log((1 + chunks.length) / (1 + (dfs.get(t) ?? 0))) + 1;

  const qTf = new Map<string, number>();
  for (const t of tokenize(query)) qTf.set(t, (qTf.get(t) ?? 0) + 1);

  const scored = chunks.map((chunk, i) => {
    const tf = chunkTokens[i];
    let dot = 0;
    let qn = 0;
    let dn = 0;
    for (const [t, f] of qTf) {
      const w = f * idf(t);
      qn += w * w;
      if (tf.has(t)) dot += w * (tf.get(t)! * idf(t));
    }
    for (const [, f] of tf) {
      // 文档范数需要逐项 idf，重新累加
    }
    // 重新计算文档范数（保证正确性）
    for (const [t, f] of tf) {
      const w = f * idf(t);
      dn += w * w;
    }
    const score = qn > 0 && dn > 0 ? dot / (Math.sqrt(qn) * Math.sqrt(dn)) : 0;
    return { chunk, score: Math.round(score * 1000) / 1000 };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** 从片段中提取与查询最相关的句子（可溯源的引用） */
function bestSentence(chunkText: string, query: string): string {
  const sentences = chunkText
    .split(/(?<=[。！？；])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);
  if (sentences.length === 0) return chunkText.slice(0, 90);
  const qTokens = new Set(tokenize(query));
  let best = sentences[0];
  let bestScore = -1;
  for (const s of sentences) {
    const sTokens = new Set(tokenize(s));
    let hit = 0;
    for (const t of qTokens) if (sTokens.has(t)) hit++;
    const score = hit / Math.max(1, qTokens.size);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best.length > 110 ? best.slice(0, 110) + "…" : best;
}

export interface RagAnswer {
  used: boolean;
  answer: string;
  citations: Citation[];
}

/** 基于检索结果生成带引用的回答 */
export function ragAnswer(query: string, docs: KnowledgeDocPayload[]): RagAnswer {
  const chunks: Chunk[] = [];
  for (const d of docs) {
    for (const piece of chunkText(d.content)) {
      chunks.push({ id: `${d.id}-${chunks.length}`, docId: d.id, docName: d.name, text: piece });
    }
  }
  const hits = retrieve(query, chunks, 3);
  const useful = hits.filter((h) => h.score >= 0.08);
  if (useful.length === 0) {
    return { used: false, answer: "", citations: [] };
  }
  const citations: Citation[] = useful.map((h, i) => ({
    id: i + 1,
    source: h.chunk.docName,
    snippet: bestSentence(h.chunk.text, query),
    score: h.score,
  }));
  const docNames = [...new Set(useful.map((h) => h.chunk.docName))];
  const lines: string[] = [];
  lines.push(`根据知识库中《${docNames.join("》《")}》的内容：`);
  lines.push("");
  for (const c of citations) {
    lines.push(`${c.id}. ${c.snippet} [${c.id}]`);
  }
  lines.push("");
  lines.push(
    `以上 ${citations.length} 条内容来自你的 ${docNames.length} 篇文档，相关度分别为 ${citations
      .map((c) => c.score.toFixed(2))
      .join(" / ")}。如需更精确的回答，可以补充更具体的关键词。`
  );
  return { used: true, answer: lines.join("\n"), citations };
}
