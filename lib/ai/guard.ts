/**
 * AI 安全与可控性模块：输入护栏 + 输出脱敏 + 兜底策略
 * 对应评审维度「AI安全与可控性」：内容过滤、可解释、兜底机制、隐私保护。
 */

/** 输入护栏：命中敏感意图时拒绝并给出引导 */
const BLOCKED_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /(制作|制造|合成).{0,6}(炸弹|爆炸物|毒气|炸药)/, reason: "危险物品制作" },
  { re: /(毒品|冰毒|大麻|海洛因).{0,8}(制作|购买|贩卖|交易)/, reason: "违法物品交易" },
  { re: /(入侵|攻击|拖库|爆破).{0,8}(网站|系统|服务器|数据库|后台)/, reason: "网络攻击" },
  { re: /(盗号|洗号|外挂|作弊器|刷分).{0,6}(工具|软件|教程|方法)/, reason: "作弊与盗号工具" },
  { re: /(个人隐私|开盒|人肉|户籍|住宿记录).{0,8}(搜索|查询|获取|购买)/, reason: "侵犯个人隐私" },
  { re: /(绕过|破解|去除).{0,6}(授权|版权|付费|验证码|license)/i, reason: "规避商业授权" },
  { re: /(赌博|色情|淫秽).{0,8}(网站|平台|推广|资源)/, reason: "违法违规内容" },
];

export interface GuardResult {
  ok: boolean;
  reason?: string;
  reply?: string;
}

export function checkGuard(question: string): GuardResult {
  const q = question.trim();
  if (!q) {
    return { ok: false, reply: "问题看起来是空的，可以试试问我：「近30天销售额的趋势如何？」" };
  }
  for (const b of BLOCKED_PATTERNS) {
    if (b.re.test(q)) {
      return {
        ok: false,
        reason: b.reason,
        reply:
          `这个问题涉及${b.reason}，我无法回答。\n\n` +
          `作为数据分析助手，我可以帮你：\n` +
          `· 对话式查询与聚合数据集\n· 生成图表与洞察报告\n· 检索你上传的知识库文档\n\n` +
          `换个数据分析相关的问题试试吧。`,
      };
    }
  }
  return { ok: true };
}

/* ============================================================
 * 输出脱敏：防止模型输出中泄露密钥或个人敏感信息（负责任 AI）
 * ========================================================== */

interface SensitiveRule {
  re: RegExp;
  repl: string;
  label: string;
}

const SENSITIVE_RULES: SensitiveRule[] = [
  // API Key（OpenAI / DeepSeek 等常见前缀）
  { re: /sk-[A-Za-z0-9_\-]{8,}/g, repl: "[已脱敏-APIKey]", label: "API Key" },
  // 凭据赋值
  { re: /(api[_-]?key|token|secret)\s*[:=]\s*["']?[A-Za-z0-9_\-]{8,}["']?/gi, repl: "[已脱敏-凭据]", label: "凭据" },
  // 中国大陆手机号
  { re: /(^|[^\d])1[3-9]\d{9}([^\d]|$)/g, repl: "$1[已脱敏-手机号]$2", label: "手机号" },
  // 身份证号（18 位）
  { re: /(^|[^\d])\d{17}[\dXx]([^\d]|$)/g, repl: "$1[已脱敏-身份证]$2", label: "身份证" },
  // 银行卡号（13-19 位）
  { re: /(^|[^\d.])\d{13,19}([^\d.]|$)/g, repl: "$1[已脱敏-卡号]$2", label: "银行卡" },
  // 电子邮箱
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, repl: "[已脱敏-邮箱]", label: "邮箱" },
];

export interface SanitizeResult {
  text: string;
  redacted: string[];
}

/**
 * 对模型输出做脱敏：命中敏感规则时替换为占位符。
 * 即便模型意外复述了密钥或 PII，也不会原样展示给用户。
 */
export function sanitizeOutput(text: string): SanitizeResult {
  if (!text) return { text: "", redacted: [] };
  let out = text;
  const redacted: string[] = [];
  for (const r of SENSITIVE_RULES) {
    const re = new RegExp(r.re.source, r.re.flags);
    if (re.test(out)) {
      out = out.replace(re, r.repl);
      if (redacted.indexOf(r.label) === -1) redacted.push(r.label);
    }
  }
  return { text: out, redacted };
}

/** 通用兜底文案（引擎异常时使用） */
export const FALLBACK_REPLY =
  "刚才的处理出现了一点波动，已为你安全中止。可以尝试：\n· 换一种问法，例如「各品类的销售额占比」\n· 缩小时间范围，例如「最近7天」\n· 点击左侧切换其他数据集";

/** 护栏能力说明（供 UI 展示「安全护栏已启用」） */
export const GUARD_CAPABILITIES = [
  "输入意图过滤：危险 / 违法 / 隐私类请求在调用模型前被拦截",
  "输出脱敏：密钥、手机号、身份证、银行卡、邮箱自动打码",
  "检索阈值回退：知识库低相关度时不强行引用",
  "预测免责：趋势预测结果附带估算说明",
  "异常兜底：模型或网络异常时给出可执行的替代建议",
];
