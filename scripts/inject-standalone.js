/**
 * 生成单文件版：
 *   1) 将 esbuild 打包的引擎注入 standalone-template.html
 *   2) 将「模型配置」从环境变量 / .env.local 注入（源码内只保留占位符，仓库零密钥）
 *
 * 优先级：系统环境变量  >  .env.local  >  内置默认
 * 变量名：DEEPSEEK_API_KEY / OPENAI_API_KEY、OPENAI_BASE_URL、OPENAI_MODEL
 *
 * 未提供密钥时注入空串 —— 单文件版自动回落「本地演示引擎」，仍可离线演示。
 * 用法：node scripts/inject-standalone.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tpl = fs.readFileSync(path.join(root, "standalone-template.html"), "utf8");
const bundle = fs.readFileSync(path.join(root, "scripts", "standalone-bundle.js"), "utf8");

if (!tpl.includes("/*__LX_BUNDLE__*/")) {
  console.error("错误：standalone-template.html 中未找到 /*__LX_BUNDLE__*/ 占位符");
  process.exit(1);
}

/* ---------- 读取 .env.local（不进 Git，每台机器各自配置） ---------- */
function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const l = line.trim();
      if (!l || l.startsWith("#")) return;
      const i = l.indexOf("=");
      if (i <= 0) return;
      out[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
  return out;
}

const fileEnv = readEnvFile(path.join(root, ".env.local"));

const API_KEY =
  process.env.DEEPSEEK_API_KEY ||
  process.env.OPENAI_API_KEY ||
  fileEnv.DEEPSEEK_API_KEY ||
  fileEnv.OPENAI_API_KEY ||
  "";

const BASE_URL =
  process.env.OPENAI_BASE_URL || fileEnv.OPENAI_BASE_URL || "https://api.deepseek.com/v1";

const MODEL = process.env.OPENAI_MODEL || fileEnv.OPENAI_MODEL || "deepseek-chat";

/* ---------- 密钥混淆（避免明文出现在产物中） ----------
 * 注意：这是混淆，不是密码学加密。前端必须还原密钥才能调用 API，
 * 故还原逻辑同样在文件内。它能防明文扫描/误泄露，不能防刻意还原。
 * 口令可用 LX_KEY_PASS 环境变量自定义（每台机器/每次构建可不同）。
 */
const PASS = process.env.LX_KEY_PASS || "lingxi-insight-2026";

function obfuscate(str, pass) {
  const buf = Buffer.from(str, "utf8");
  const key = Buffer.from(pass, "utf8");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out.toString("base64");
}

/* ---------- 注入 ---------- */
let out = tpl.replace("/*__LX_BUNDLE__*/", () =>
  bundle.replace(/<\/script>/gi, "<\\/script>")
);

if (out.includes("__LX_LLM_KEY__")) {
  out = out
    .replace("__LX_LLM_KEY__", () => (API_KEY ? obfuscate(API_KEY, PASS) : ""))
    .replace("__LX_LLM_BASE__", () => BASE_URL)
    .replace("__LX_LLM_MODEL__", () => MODEL)
    .replace("__LX_LLM_PASS__", () => PASS);
} else {
  console.warn("警告：模板中未找到模型配置占位符，跳过配置注入");
}

fs.writeFileSync(path.join(root, "standalone.html"), out);

const masked = API_KEY ? API_KEY.slice(0, 7) + "..." + API_KEY.slice(-4) : "(未提供)";
console.log(`已生成 standalone.html（${(out.length / 1024).toFixed(1)} KB）`);
console.log(
  `  模型通道：${API_KEY ? "已内置默认密钥 → " + MODEL : "未提供密钥 → 回落本地演示引擎"}`
);
console.log(`  Key：${masked}`);
console.log(`  Base：${BASE_URL}`);
