/**
 * POST /api/rag — 知识库检索测试接口
 * 供前端「知识库面板」预览检索质量（Top K 片段与相关度）
 */

import { chunkText, retrieve } from "@/lib/ai/rag";
import type { KnowledgeDocPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { query?: string; docs?: KnowledgeDocPayload[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }
  const docs = body.docs ?? [];
  if (docs.length === 0) {
    return Response.json({ error: "知识库为空，请先添加文档" }, { status: 400 });
  }

  const chunks = docs.flatMap((d) =>
    chunkText(d.content).map((text, i) => ({
      id: `${d.id}-${i}`,
      docId: d.id,
      docName: d.name,
      text,
    }))
  );
  const hits = retrieve(body.query ?? "", chunks, 5);
  return Response.json({
    total: chunks.length,
    hits: hits.map((h) => ({
      docName: h.chunk.docName,
      score: h.score,
      preview: h.chunk.text.slice(0, 120),
    })),
  });
}
