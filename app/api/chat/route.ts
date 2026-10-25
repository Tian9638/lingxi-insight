/**
 * POST /api/chat — AI Agent 流式对话接口（SSE）
 *
 * 请求体：AgentInput（问题 + 数据集载荷 + 知识库文档 + 模式开关）
 * 响应：text/event-stream，逐行推送 AgentEvent（见 lib/types.ts 协议）
 *
 * 通道选择：
 *  - 配置 OPENAI_API_KEY：真实大模型通道（Function Calling 工具循环）
 *  - 未配置：本地演示引擎（ReAct 循环，结果真实可复现）
 *  - 真实通道异常时自动回退本地引擎，保证演示不中断
 */

import { runAgent } from "@/lib/ai/engine";
import { getOpenAIConfig, runWithOpenAI } from "@/lib/ai/openai";
import type { AgentEvent, AgentInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 4 * 1024 * 1024; // 4MB，防止超大请求体

export async function POST(req: Request) {
  let input: AgentInput;
  try {
    input = (await req.json()) as AgentInput;
  } catch {
    return Response.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }
  if (!input?.question || !input.question.trim()) {
    return Response.json({ error: "问题不能为空" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const cfg = getOpenAIConfig();
  const want = input.channel ?? "auto";
  // local = 强制本地；auto/llm = 有配置就用真实模型
  const useReal = want !== "local" && !!cfg;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (ev: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          closed = true;
        }
      };

      req.signal.addEventListener("abort", () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* 已关闭 */
        }
      });

      try {
        if (useReal) {
          let failed = false;
          let finished = false;
          for await (const ev of runWithOpenAI(input, cfg!)) {
            if (ev.type === "error") {
              failed = true;
              break;
            }
            send(ev);
            if (ev.type === "done") {
              finished = true;
              break;
            }
          }
          if (finished) return;
          if (failed) {
            send({
              type: "text",
              delta: "\n\n> ⚠️ 真实模型通道暂时不可用，已自动回退至本地演示引擎（工具层与数据层完全一致）。\n\n",
            });
          } else {
            return;
          }
        }
        // 用户明确选择了「真实模型」但服务端未配置 Key：说明原因后回退本地引擎
        if (want === "llm" && !cfg) {
          send({
            type: "text",
            delta:
              "\n\n> ⚠️ 已选择「真实模型」，但服务端尚未配置 OPENAI_API_KEY，已回退至本地演示引擎。\n" +
              "> 配置方法：在项目目录创建 .env.local 并填入 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL，然后重启服务（详见 docs/模型接入指南.md）。\n\n",
          });
        }
        for await (const ev of runAgent(input)) send(ev);
      } catch (err) {
        send({
          type: "error",
          message: `服务端处理异常：${(err as Error).message || "未知错误"}`,
        });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* 已关闭 */
          }
        }
      }
    },
  });

  void MAX_BODY;

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
