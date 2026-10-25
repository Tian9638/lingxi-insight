/**
 * 真实大模型通道（OpenAI 兼容协议）
 *
 * 配置 OPENAI_API_KEY 后，AI 引擎从「本地演示引擎」切换为本通道：
 *  - 通过 Chat Completions 流式接口驱动 LLM
 *  - 通过 Function Calling 暴露与本地引擎完全相同的工具集（tools.ts）
 *  - 工具在服务端真实执行（queryData / ragAnswer / ...），结果回注 LLM 继续推理
 * 兼容 OpenAI / DeepSeek / 智谱 GLM / 通义千问 / Kimi 等端点。
 */

import type { AgentEvent, AgentInput } from "../types";
import { checkGuard } from "./guard";
import { buildSystemPrompt } from "./prompts";
import { TOOL_DEFS, TOOL_LABELS, executeTool } from "./tools";
import { classifyIntent } from "./nlp";
import { rid, sleep } from "../utils";

interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getOpenAIConfig(): OpenAIConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

/** 解析 OpenAI 流式 SSE 分片 */
async function* readOpenAIStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<any> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        yield JSON.parse(payload);
      } catch {
        // 忽略不完整分片
      }
    }
  }
}

interface ToolCallAcc {
  id: string;
  name: string;
  args: string;
}

export async function* runWithOpenAI(
  input: AgentInput,
  cfg: OpenAIConfig
): AsyncGenerator<AgentEvent> {
  const t0 = Date.now();
  const q = input.question.trim();

  // 护栏在本地先行执行，避免无效的 API 消耗
  const guard = checkGuard(q);
  if (!guard.ok) {
    yield { type: "text", delta: guard.reply! };
    yield { type: "done", ok: true };
    return;
  }

  yield {
    type: "meta",
    model: cfg.model,
    requestId: rid("req-"),
    deep: input.deep,
    channel: "llm",
  };
  yield { type: "plan", steps: [`调用真实模型 ${cfg.model}`, "Function Calling 工具循环", "流式生成回答"] };

  const messages: any[] = [
    { role: "system", content: buildSystemPrompt(input) },
    ...input.history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: q },
  ];

  let toolCalls = 0;
  let completionChars = 0;
  /** 是否已向前端推送过图表（LLM 可能不调用 recommend_chart，需自动补全） */
  let chartEmitted = false;

  for (let iter = 0; iter < 6; iter++) {
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          tools: TOOL_DEFS,
          tool_choice: "auto",
          stream: true,
          temperature: 0.3,
          // 请求 API 在末帧返回精确 token 用量（OpenAI 标准；不支持的厂商会忽略该字段）
          stream_options: { include_usage: true },
        }),
      });
    } catch (err) {
      yield { type: "error", message: `无法连接模型服务：${(err as Error).message}` };
      return;
    }
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      yield { type: "error", message: `模型服务返回 ${res.status}：${detail.slice(0, 160)}` };
      return;
    }

    let content = "";
    let realUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
    const accs = new Map<number, ToolCallAcc>();

    for await (const chunk of readOpenAIStream(res.body)) {
      // include_usage 时末帧 choices 为空、仅携带 usage
      if (chunk?.usage) realUsage = chunk.usage;
      const delta = chunk?.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        completionChars += delta.content.length;
        yield { type: "text", delta: delta.content };
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!accs.has(idx)) accs.set(idx, { id: "", name: "", args: "" });
          const acc = accs.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
        }
      }
    }

    const pending = [...accs.values()].filter((a) => a.name);
    if (pending.length === 0) {
      yield {
        type: "usage",
        promptTokens: realUsage?.prompt_tokens ?? q.length + 400,
        completionTokens: realUsage?.completion_tokens ?? completionChars,
        toolCalls,
        latencyMs: Date.now() - t0,
      };
      yield { type: "done", ok: true };
      return;
    }

    // 有工具调用：本地执行并回注
    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: pending.map((a) => ({
        id: a.id || rid("call-"),
        type: "function",
        function: { name: a.name, arguments: a.args || "{}" },
      })),
    });

    for (const acc of pending) {
      toolCalls += 1;
      const id = acc.id || rid("call-");
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(acc.args || "{}");
      } catch {
        args = {};
      }
      yield {
        type: "tool_call",
        id,
        name: acc.name,
        label: TOOL_LABELS[acc.name] ?? acc.name,
        args,
      };
      const outcome = executeTool(acc.name, args, {
        dataset: input.dataset,
        docs: input.docs,
      });
      // 行为对齐本地引擎：LLM 仅调用 query_data 时，自动补全「智能图表推荐」，
      // 保证两条通道的图表呈现一致；若 LLM 后续又显式调用则去重。
      if (acc.name === "query_data" && !outcome.chart && !chartEmitted) {
        outcome.chart = executeTool("recommend_chart", args, {
          dataset: input.dataset,
          docs: input.docs,
        }).chart;
      }
      if (acc.name === "recommend_chart" && chartEmitted) {
        outcome.chart = undefined;
      }
      if (outcome.chart) chartEmitted = true;
      await sleep(60);
      yield {
        type: "tool_result",
        id,
        ok: true,
        summary: outcome.summary,
        chart: outcome.chart,
        metrics: outcome.metrics,
        table: outcome.table,
      };
      messages.push({
        role: "tool",
        tool_call_id: id,
        content: JSON.stringify(outcome.data ?? { summary: outcome.summary }),
      });
    }
  }

  yield { type: "text", delta: "\n\n（已达到最大工具调用轮数，以上为基于已获取数据的回答）" };
  yield { type: "done", ok: true };
}

/** 意图标签（真实通道的兜底说明用） */
export function describeIntent(q: string): string {
  return classifyIntent(q);
}
