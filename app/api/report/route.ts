/**
 * POST /api/report — 一键生成结构化洞察报告（Markdown，流式返回）
 */

import { composeReport } from "@/lib/ai/insight";
import type { DatasetPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { dataset?: DatasetPayload; questions?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }
  if (!body.dataset) {
    return Response.json({ error: "缺少数据集" }, { status: 400 });
  }

  const md = composeReport(body.dataset, body.questions ?? []);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // 按 6 字符分片流式输出，模拟 LLM 逐字生成
        for (let i = 0; i < md.length; i += 6) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(md.slice(i, i + 6))}\n\n`)
          );
          await new Promise((r) => setTimeout(r, 8));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch {
        /* 客户端断开 */
      } finally {
        try {
          controller.close();
        } catch {
          /* 已关闭 */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
