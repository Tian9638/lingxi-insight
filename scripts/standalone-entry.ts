/**
 * 单文件版入口：导出浏览器环境可用的纯逻辑模块
 * （engine / insight / rag / guard / datasets / tools）
 * tools 与 prompts 导出供「浏览器端真实模型通道」复用：
 * 同一套 Function Calling 协议与工具执行，保证与完整版行为一致。
 */
export { getSampleDatasets, SUGGESTIONS } from "../lib/data/datasets";
export { runAgent } from "../lib/ai/engine";
export { composeReport } from "../lib/ai/insight";
export { chunkText, ragAnswer } from "../lib/ai/rag";
export { checkGuard, sanitizeOutput, GUARD_CAPABILITIES } from "../lib/ai/guard";
export { TOOL_DEFS, TOOL_LABELS, executeTool, specFromArgs } from "../lib/ai/tools";
export { buildSystemPrompt } from "../lib/ai/prompts";
