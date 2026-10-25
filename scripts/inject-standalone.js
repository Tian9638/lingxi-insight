/**
 * 生成单文件版：将 esbuild 打包的引擎注入 standalone-template.html
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

const out = tpl.replace("/*__LX_BUNDLE__*/", () =>
  bundle.replace(/<\/script>/gi, "<\\/script>")
);
fs.writeFileSync(path.join(root, "standalone.html"), out);
console.log(`已生成 standalone.html（${(out.length / 1024).toFixed(1)} KB）`);
