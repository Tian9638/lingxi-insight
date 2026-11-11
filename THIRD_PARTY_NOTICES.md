# 第三方开源组件声明（THIRD-PARTY NOTICES）

本文件列出「灵犀洞察」所使用的第三方开源组件及其许可信息，与仓库根目录
`LICENSE`（本项目采用 MIT License）配套使用。

> 数据来源：仓库 `package-lock.json` 的 `packages.*.license` 字段。
> 复现方式：`npm ci` 安装后可用任意 SPDX 工具（如 `license-checker`、Syft / CycloneDX）
> 重新生成依赖清单。本文所列版本均为锁文件固定版本。

## 1. 依赖树许可分布

对完整依赖树 **149 个包** 扫描的结果：

| 许可证 | 包数量 | 类型 |
| --- | ---: | --- |
| MIT | 128 | 宽松许可 |
| ISC | 10 | 宽松许可 |
| Apache-2.0 | 6 | 宽松许可（含专利授权条款） |
| BSD-3-Clause | 1 | 宽松许可 |
| 0BSD | 1 | 宽松许可 |
| CC-BY-4.0 | 1 | 数据/内容许可（`caniuse-lite`，仅构建期浏览器兼容数据） |
| 包元数据未标注 | 2 | `busboy`、`streamsearch`（上游仓库均为 MIT，锁文件未写入该字段） |

**未发现 GPL、AGPL、LGPL、SSPL、MPL、EPL 等强著佐权（copyleft）组件**，
因此不存在与本项目 MIT 主许可冲突、或要求开源衍生作品的传染性义务。

## 2. 直接依赖清单

### 生产依赖（`dependencies`，8 个）

| 组件 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| next | 14.2.15 | MIT | App Router 框架，承载 SSE 接口与服务端 AI 逻辑 |
| react | 18.3.1 | MIT | 视图层 |
| react-dom | 18.3.1 | MIT | DOM 渲染 |
| zustand | 4.5.5 | MIT | 轻量状态管理，流式事件消费 |
| lucide-react | 0.446.0 | ISC | 图标系统 |
| papaparse | 5.4.1 | MIT | CSV 解析与类型推断 |
| clsx | 2.1.1 | MIT | 条件类名 |
| tailwind-merge | 2.5.3 | MIT | Tailwind 类名合并 |

### 开发依赖（`devDependencies`）

| 组件 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| typescript | 5.6.2 | Apache-2.0 | 类型系统（strict 模式） |
| tailwindcss | 3.4.13 | MIT | 样式框架 |
| postcss | 8.4.47 | MIT | CSS 处理 |
| autoprefixer | 10.4.20 | MIT | CSS 前缀补全 |
| esbuild | 0.23.1 | MIT | 单文件离线版打包 |
| @types/node | 20.16.11 | MIT | Node.js 类型声明 |
| @types/react | 18.3.11 | MIT | React 类型声明 |
| @types/react-dom | 18.3.0 | MIT | React DOM 类型声明 |
| @types/papaparse | 5.3.14 | MIT | PapaParse 类型声明 |

### 需单独说明的传递依赖

| 组件 | 许可证 | 说明 |
| --- | --- | --- |
| caniuse-lite | CC-BY-4.0 | 浏览器兼容数据，供 autoprefixer / Tailwind 构建期使用；CC-BY-4.0 要求署名，特此声明 |
| source-map-js | BSD-3-Clause | 源码映射解析，要求保留版权声明与免责条款 |
| tslib | 0BSD | TypeScript 运行时辅助库 |
| busboy · streamsearch | 包元数据未标注（上游为 MIT） | Next.js 的 multipart 解析依赖，仅服务端构建期使用 |

## 3. 许可义务履行说明

上述 MIT / ISC / 0BSD / BSD-3-Clause / Apache-2.0 组件均要求在其副本或
「实质性部分」中保留版权声明与许可声明。本项目通过以下方式履行：

1. 依赖以 `node_modules/` 形式由 `npm ci` 安装，各包自带的 `LICENSE` 文件随安装完整保留，
   本项目不修改、不剥离其许可文件；
2. `node_modules/` 不纳入版本控制（见 `.gitignore`），分发源码时由使用者按
   `package-lock.json` 自行安装，许可文件随包一并获取；
3. 本文件与 `LICENSE` 随仓库一同分发，集中披露上游组件及许可归属；
4. `caniuse-lite` 的 CC-BY-4.0 数据署名已在本节给出。

## 4. 自主实现边界（反向声明）

为避免归属误读，以下能力为本项目**自主实现**，并非来自下列第三方库：
纯 SVG 图表引擎（未使用 ECharts / D3 / Chart.js / AntV）、TF-IDF RAG 检索
（未使用向量数据库或 Embedding 服务）、ReAct Agent 编排
（未使用 LangChain / LlamaIndex 等编排框架）。

SSE、Web Speech API、OpenAI Chat Completions / Function Calling 属公开协议、
W3C 标准或行业事实接口，本项目依规范自行实现，未引入厂商私有 SDK。

## 5. 非开源组件与第三方服务

| 项目 | 性质 | 说明 |
| --- | --- | --- |
| DeepSeek / OpenAI / 智谱 GLM / 通义千问 / Kimi | 第三方商业 API 服务 | 其服务条款、计费与用量限制独立适用，不属于本仓库开源许可范围 |
| 浏览器内置 Web Speech API | 平台能力 | 由用户浏览器提供，非分发组件 |
| 内置示例数据集 | 本项目确定性合成 | 由固定种子算法生成，不含真实个人信息，可自由使用 |
| 技术文档 PDF、演示视频 | 竞赛提交材料 | 文档随 `docs/` 开源，视频不纳入代码库分发 |

## 6. 致谢

感谢上述所有上游项目的作者与维护者，以及 W3C 相关规范制定者。
本作品在开源社区提供的基础设施之上完成，特此致谢。
