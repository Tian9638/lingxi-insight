/**
 * GET /api/config — 向前端暴露当前 AI 引擎通道信息
 * 注意：只返回模型名，绝不返回 API Key。
 */

import { NextResponse } from "next/server";
import { getOpenAIConfig } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getOpenAIConfig();
  return NextResponse.json({
    channel: cfg ? "llm" : "local",
    isLlm: !!cfg,
    model: cfg?.model ?? null,
    label: cfg ? `${cfg.model} · 真实模型` : "本地演示引擎",
  });
}
