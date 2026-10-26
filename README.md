# 灵犀洞察 · LingXi Insight

> **AI 原生对话式数据分析平台** —— 与数据对话，让洞察自然流动。
> 传智杯 AI Web 开发挑战赛参赛作品 · 命题方向：AI 数据分析与可视化（兼融 AI Agent / RAG / 多模态交互）

---

## 一、项目简介

灵犀洞察是一款 **AI Native** 的 Web 前端应用：用户上传或选择数据集后，用自然语言提问，
AI Agent 自动完成「意图理解 → 数据查询聚合 → 智能图表推荐 → 洞察文本生成」全链路，
并以流式（SSE）方式将思考过程、工具调用、图表与解读实时呈现给用户。

**核心设计理念：AI 过程透明化。** 每一次回答都不是黑盒——右侧「Agent 追踪」面板
实时展示 ReAct 循环（规划 → 工具调用 → 观察 → 生成）的每一步，包括工具参数、
执行耗时与返回摘要，所有统计数字均由服务端真实计算，无任何虚构数据。

### 功能特性

| 模块 | 说明 |
| --- | --- |
| 对话式分析 | 10+ 意图识别（趋势/占比/排名/对比/相关性/异常/预测/报告/问候/澄清），自动解析指标、维度、聚合方式、时间范围、Top N 与维度值过滤 |
| Agent 透明协作 | ReAct 循环事件流；规划步骤、工具调用参数与耗时、token 用量全程可审计 |
| 智能图表引擎 | 自研纯 SVG 图表（折线/柱状/水平条形/环形/散点），支持预测虚线、异常点标注、入场动画、原生 tooltip |
| RAG 知识库 | 文档滑动窗口切片、中文二元组分词、TF-IDF 余弦相似度检索，回答附带可溯源引用与相关度评分 |
| 多模态交互 | 语音输入（Web Speech API 实时转写）+ 语音播报（SpeechSynthesis 朗读回复）、流式 Markdown 渲染、思考状态可视化、生成过程可随时中断 |
| 数据接入 | 4 套内置合成数据集（确定性生成，含县域乡村振兴社会价值主题）+ CSV 上传（自动列类型推断，5000 行上限） |
| 洞察报告 | 一键生成结构化 Markdown 报告（数据概览/核心发现/趋势分析/行动建议），可下载 |
| 安全与可控 | 输入护栏（7 类敏感意图拦截）+ 输出脱敏（密钥/手机号/身份证/银行卡/邮箱自动打码）、检索阈值回退、真实模型通道异常自动降级至本地引擎、API Key 环境变量化 |

### 与评审维度的对应关系

| 评审维度（权重） | 实现对应 |
| --- | --- |
| AI 技术深度 35% | LLM 抽象层（本地引擎 + OpenAI 兼容通道可替换）、Function Calling 工具集、RAG 全链路、多模态输入、安全护栏与兜底 |
| 创新性 25% | 「思考过程全透明」的 Agent 协作范式；纯 SVG 图表引擎；统一事件协议的双通道架构 |
| 前端工程质量 10% | TypeScript strict、组件化架构、Zustand 状态管理、零图表库依赖、错误边界、响应式三栏布局 |
| 实用性 10% | 面向「不会写 SQL 的业务/学生」的真实数据分析痛点；CSV 即插即用 |
| 用户体验 10% | 统一 SVG 图标系统（29 枚描边图标，全局零 emoji）、流式渲染、骨架/打字动画、语音输入+语音播报、一键中断、报告导出、推荐问题引导 |
| 社会价值与商业潜力 10% | 降低数据分析门槛（教育/中小企业/基层公务）；内置县域乡村振兴监测数据集，支持收入/教育/医疗/产业多维分析；视障与不擅长打字用户可用语音闭环；可平滑升级为生产级 BI Copilot |

---

## 二、技术架构

```
┌──────────────────────────────────────────────────────────────────┐
│ 用户界面层   Next.js 14 App Router · React 18 · TypeScript        │
│              Tailwind CSS · Zustand · lucide-react                │
├──────────────────────────────────────────────────────────────────┤
│ 交互协议层   SSE（Server-Sent Events）· 统一 AgentEvent 协议        │
│              meta / plan / tool_call / tool_result /              │
│              text(delta) / citations / usage / done / error       │
├──────────────────────────────────────────────────────────────────┤
│ AI 引擎层    ReAct 编排 · 意图理解(NLP) · 工具调用 · RAG · 安全护栏  │
│              ┌─────────────────────┬──────────────────────┐      │
│              │ 本地演示引擎(默认)    │ OpenAI 兼容通道(可选)  │      │
│              │ 确定性 · 可复现      │ Function Calling     │      │
│              └─────────────────────┴──────────────────────┘      │
│                      └──── 共享同一套工具层 tools.ts ────┘        │
├──────────────────────────────────────────────────────────────────┤
│ 数据层       内存数据集 · PapaParse 类型推断 · TF-IDF 倒排索引      │
│              分组聚合 · Z-Score 异常检测 · 线性趋势预测             │
└──────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
lingxi-insight/
├── app/
│   ├── page.tsx                  # 落地页
│   ├── layout.tsx                # 根布局（元数据 / 全局样式）
│   ├── globals.css               # 设计令牌 + 动画关键帧
│   ├── icon.svg                  # 站点图标
│   ├── error.tsx / not-found.tsx # 错误边界
│   ├── workspace/page.tsx        # 工作台（核心页面）
│   └── api/
│       ├── chat/route.ts         # SSE 流式 Agent 接口（含通道回退）
│       ├── report/route.ts       # 洞察报告流式生成
│       └── rag/route.ts          # 知识库检索测试接口
├── components/
│   ├── ui.tsx                    # Button/Card/Badge/MarkdownLite 等基础组件
│   ├── landing/Landing.tsx       # 落地页（Hero/能力/原理/架构/技术栈）
│   └── workspace/
│       ├── Workspace.tsx         # 三栏布局编排 + 报告弹窗 + Toast
│       ├── Sidebar.tsx           # 数据源 / 知识库 / 引擎设置
│       ├── ChatPanel.tsx         # 对话流 + 语音输入 + 中断
│       ├── MessageBubble.tsx     # 消息内容块渲染
│       ├── Charts.tsx            # 纯 SVG 图表引擎
│       ├── AgentTrace.tsx        # Agent 追踪面板
│       └── DataPreview.tsx       # 原始数据预览
├── lib/
│   ├── types.ts                  # 前后端共享契约（AgentEvent 协议）
│   ├── store.ts                  # Zustand 全局状态 + SSE 流式消费
│   ├── utils.ts                  # 日期/数字格式化工具
│   ├── data/
│   │   ├── datasets.ts           # 内置数据集（种子确定性生成）
│   │   └── csv.ts                # CSV 解析与列类型推断
│   └── ai/
│       ├── engine.ts             # 本地演示引擎（ReAct 编排）
│       ├── openai.ts             # OpenAI 兼容真实模型通道
│       ├── tools.ts              # 工具注册表（双通道共用）
│       ├── nlp.ts                # 意图识别 + 查询规格解析
│       ├── dataops.ts            # 数据查询聚合引擎
│       ├── insight.ts            # 洞察文本 / 报告生成
│       ├── rag.ts                # 切片 + TF-IDF + 余弦检索
│       ├── guard.ts              # 输入护栏与兜底
│       └── prompts.ts            # 系统提示词设计
├── scripts/e2e-test.mjs          # 端到端测试（13 项断言）
├── scripts/standalone-entry.ts   # 单文件版引擎入口
├── scripts/inject-standalone.js  # 单文件版构建脚本
├── standalone-template.html      # 单文件版模板（UI + CSS）
├── standalone.html               # 单文件版产物（双击即可运行）
├── docs/技术文档.md               # 竞赛技术文档（PDF 内容稿）
├── .env.example                  # 环境变量模板
└── package.json
```

---

## 三、快速开始

### 环境要求

| 项目 | 要求 | 本项目实测版本 |
| --- | --- | --- |
| Node.js | ≥ 18.17（推荐 20 LTS 及以上） | v22.22.2 |
| 包管理器 | npm / pnpm / yarn 任一 | npm 10.9.7 |
| 操作系统 | Windows / macOS / Linux 均可 | Windows 11 |
| 浏览器 | Chrome / Edge（语音输入需 Web Speech API） | Edge |
| 网络 | 仅接入真实大模型时需要；纯本地演示可完全离线 | — |

> **零配置可运行**：不填任何环境变量即可完整体验全部功能（走内置本地演示引擎）。

### 依赖清单

生产依赖（`dependencies`）：

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| next | 14.2.15 | App Router 框架，承载 SSE 接口与服务端 AI 逻辑 |
| react / react-dom | 18.3.1 | 视图层 |
| zustand | 4.5.5 | 轻量状态管理，流式事件消费 |
| lucide-react | 0.446.0 | 图标 |
| papaparse | 5.4.1 | CSV 解析与类型推断 |
| clsx / tailwind-merge | 2.1.1 / 2.5.3 | 条件样式与类名合并 |

开发依赖（`devDependencies`）：

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| typescript | 5.6.2 | 类型系统（strict 模式） |
| tailwindcss / postcss / autoprefixer | 3.4.13 / 8.4.47 / 10.4.20 | 样式工具链 |
| esbuild | 0.23.1 | 单文件离线版打包 |
| @types/* | 20.16.11 等 | 类型声明 |

> 图表为**自研纯 SVG 实现，未引入任何图表库**；RAG 的 TF-IDF 检索亦为自研，无向量库依赖。
> 完整锁定版本见仓库根目录 `package-lock.json`（`npm ci` 可精确复现依赖树）。

### 安装与运行

```bash
# 1. 安装依赖（或用 npm ci 严格按 package-lock.json 安装）
npm install

# 2. 启动开发服务器（默认 http://localhost:3000）
npm run dev

# 3. 生产构建与预览
npm run build
npm start
```

### 单文件离线版（双击即可运行）

仓库同时提供**单文件版** `standalone.html`（约 155KB）：完整应用（落地页 + 工作台 +
AI 引擎 + 图表引擎 + RAG）全部内联于一个 HTML，**无需安装、无需服务器**，双击即可在浏览器打开。

单文件版同样支持**接入真实大模型**：点右上角「⚙️ 模型设置」填入 OpenAI 兼容接口
（DeepSeek 已预填，另附 OpenAI / 智谱 / 通义 / Kimi 预设），密钥仅保存在当前浏览器的
localStorage，**HTML 文件本身不含任何密钥**（可安全传阅）；浏览器经 CORS 直连 API，
工具调用与完整版完全一致（同一工具层）。未配置时使用内置本地演示引擎。

```bash
# 重新生成单文件版（引擎由 esbuild 打包后注入模板）
npm run build:standalone
```

> 单文件版与完整版共享同一套 AI 引擎源码（`lib/ai/*`），差异仅在载体：
> 完整版经 Next.js + SSE 服务端渲染，单文件版在浏览器内直接运行引擎（含浏览器端 Function Calling 工具循环）。

### 环境变量（可选）

复制 `.env.example` 为 `.env.local`。**不配置任何 Key 即可完整体验全部功能**
（使用内置本地演示引擎）。配置后自动切换为真实大模型通道：

```bash
# 任何 OpenAI Chat Completions 兼容端点均可
# （OpenAI / DeepSeek / 智谱 GLM / 通义千问 / Kimi …）
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

真实通道下，LLM 通过 Function Calling 调用与本地引擎**完全相同**的工具集
（`query_data` / `get_overview` / `detect_anomaly` / `forecast` / `search_knowledge`），
工具在服务端真实执行，结果回注 LLM 继续推理；通道异常时自动回退本地引擎，演示不中断。

#### 单文件版的密钥注入（构建期，源码零密钥）

单文件版同样「双击即用、无需输入密钥」，但**密钥不写入源码**：
`standalone-template.html` 中只保留 `__LX_LLM_KEY__` 等占位符，
`npm run build:standalone` 在构建时读取环境变量并注入产物 `standalone.html`。

```bash
# 方式一：写入 .env.local（推荐，已被 .gitignore 忽略）
OPENAI_API_KEY=sk-xxx

# 方式二：直接注入系统环境变量（换机器时无需复制文件）
# Windows PowerShell（用户级，永久生效）
setx DEEPSEEK_API_KEY "sk-xxx"
# macOS / Linux：写入 ~/.bashrc 或 ~/.zshrc
export DEEPSEEK_API_KEY="sk-xxx"

npm run build:standalone   # 读取变量 → 注入 → 生成 standalone.html
```

优先级：**系统环境变量 > `.env.local` > 内置默认**。
未提供密钥时注入空串，单文件版自动回落本地演示引擎，**仍可完整离线演示**。

> 该设计满足竞赛「API 密钥不得出现在公开仓库中，须通过环境变量配置」的要求：
> 仓库内 `standalone-template.html` 与所有源码均**不含任何密钥**。
> 注意：构建产物 `standalone.html` 会包含注入的密钥，公开传阅前请勿提交该文件。

#### 产物内密钥的混淆存储

注入到 `standalone.html` 的密钥**不以明文保存**，而是构建期混淆（XOR + Base64），
运行时在内存中还原，产物中搜索不到 `sk-` 开头的字符串：

```bash
LX_KEY_PASS=your-own-passphrase npm run build:standalone   # 可自定义混淆口令
```

> **正确定性说明**：本作品是纯前端直连 API，浏览器最终必须以明文密钥发出请求，
> 因此这属于**混淆**而非密码学加密——还原逻辑同样在文件内。
> - 能防：明文搜索、编辑器里被一眼看到、GitHub Secret Scanning 之类的自动扫描、
>   演示录屏/截图误泄露、随手转发时被 Ctrl+F 搜到
> - 不能防：拿到文件的人按同样方法还原（控制台执行同一函数即可）
>
> 真正的强隔离只能把密钥放在服务端做代理，代价是需要服务器，与本作品
> 「免安装、免服务器、双击即用」的定位冲突，故此处为有意取舍。
> 需要更强保护时，可在 DeepSeek 控制台对密钥设置额度上限并定期轮换。

### 演示脚本（建议按此顺序录制演示视频）

| # | 操作 | 展示点 |
| --- | --- | --- |
| 1 | 进入工作台，选择「电商销售明细」 | 数据接入 |
| 2 | 提问「近30天销售额的趋势如何？」 | 流式解读 + 指标卡 + 折线图 + Agent 追踪 |
| 3 | 提问「各品类销售额占比是多少？」 | 环形图 + 结构分析 |
| 4 | 提问「对比小程序商城和App的销售额」 | 双序列对比图 |
| 5 | 提问「预测未来7天销售额」 | 预测虚线 + 风险提示 |
| 6 | 提问「最近90天有哪些异常波动？」 | 异常点标注 |
| 7 | 左侧添加知识库文档，提问「根据知识库，…」 | RAG 引用 |
| 8 | 点击「生成洞察报告」并下载 | 报告导出 |
| 9 | 上传一份 CSV | 类型推断与即插即用 |
| 10 | 切换「灵犀-Lite / 深度思考」 | 引擎可配置性 |

### 运行测试

```bash
npm run build && npm start &
node scripts/e2e-test.mjs    # 13 项端到端断言（需服务运行在 3100 端口）
```

---

## 四、AI 引擎设计说明

### 4.1 统一事件协议（lib/types.ts）

前后端通过 SSE 交换 `AgentEvent`：

| 事件 | 载荷 | 用途 |
| --- | --- | --- |
| `meta` | 模型名 / requestId / 深度模式 | 会话元信息 |
| `plan` | 规划步骤列表 | 渲染「分析规划」 |
| `tool_call` | 工具名 / 参数 | 追踪面板工具节点 |
| `tool_result` | 摘要 / 图表 / 指标 / 表格 | 消息内容块 |
| `text` | 增量文本 | 流式渲染 |
| `citations` | 引用列表 | RAG 可溯源 |
| `usage` | tokens / 工具次数 / 耗时 | 用量统计 |
| `done` / `error` | — | 收尾 / 错误边界 |

### 4.2 ReAct 循环（lib/ai/engine.ts）

```
意图识别(nlp.classifyIntent)
   └─ 输入护栏(guard.checkGuard)
        └─ RAG 分支（命中则带引用回答，未命中按阈值回退）
             └─ 数据分支：
                  规划(plan) → query_data → recommend_chart
                  → [detect_anomaly | forecast] → 流式洞察文本 → usage/done
```

### 4.3 工具层（lib/ai/tools.ts）

`executeTool(name, args, ctx)` 是双通道共用的唯一工具实现：
`query_data`（过滤/分组/聚合/排序）、`get_overview`、`detect_anomaly`（Z-Score）、
`forecast`（最小二乘线性外推）、`search_knowledge`（TF-IDF）、
`analyze_correlation`（Pearson）。真实模型通道以 OpenAI Function Calling 协议
暴露同一组工具（`TOOL_DEFS`），保证两条通道产出结构完全一致。

### 4.4 查询解析（lib/ai/nlp.ts）

中文规则引擎：指标/维度同义词映射、时间范围（`最近N天/本周/上月/N年`）、
时间粒度（日/周/月）、聚合方式（sum/avg/max/min/count）、维度值匹配（含前缀模糊匹配，
支撑「小程序」→「小程序商城」）、Top N 提取、对比取值识别。

### 4.5 RAG 实现（lib/ai/rag.ts）

滑动窗口切片（160 字符 / 重叠 40，标点优先断点）→ 中文二元组 + 英文单词分词 →
TF-IDF 加权 → 余弦相似度 Top-K → 抽取最相关句子作为引用 → 相关度阈值 0.08 未命中则回退。
该实现与真实 Embedding 检索**接口对齐**，可在同一接口下替换为向量数据库
（如 pgvector / Milvus），无需改动上层。

### 4.6 安全设计（lib/ai/guard.ts）

- 输入护栏：敏感意图正则拦截，返回合规引导而非生硬拒绝；
- 输出兜底：引擎异常时返回可操作的降级建议；
- 通道降级：真实模型不可用自动回退本地引擎并明确告知用户；
- 密钥安全：API Key 仅通过环境变量注入，源码与仓库零硬编码；
- 预测免责：所有预测输出均标注「演示性预测，仅供参考」。

---

## 五、已知限制与后续路线

**当前限制**

- 本地演示引擎的解读文本为模板化合成的确定性输出（数字真实、结构稳定），
  个性化表达弱于 LLM；配置真实模型 Key 后即由 LLM 生成解读；
- 数据集在请求时随载荷发送（上限 3000 行），未做服务端持久化；
- 语音输入依赖浏览器 Web Speech API（Chrome / Edge 体验最佳）；
- 预测为线性外推，未建模季节性与周期性。

**后续路线**

- 接入向量数据库替换 TF-IDF，支持百页级文档语义检索；
- 数据集持久化（IndexedDB / 云数据库）与多会话历史管理；
- 增加 SARIMAX / Prophet 级季节性预测；
- 多 Agent 编排（分析 Agent + 图表 Agent + 报告 Agent 协作）；
- 团队协作看板与分享链接。

---

## 六、参赛与团队信息

| 项目 | 内容 |
| --- | --- |
| 参赛赛事 | 2026 第九届传智杯全国大学生数智创新与 AI 应用大赛 |
| 参赛赛道 | AI WEB 网页开发挑战赛（全国高校 AI Web 开发挑战赛）· **A 组** |
| 参赛院校 | 三江美术学院 |
| 团队名称 | 灵犀洞察队 |
| 代码仓库 | GitHub / Gitee 双平台 Public 仓库 |
| 在线演示 | https://lingxi-insight.app.workbuddy.host/?sharecode=EWXS56ETEE（评审期间保持可用） |

| 角色 | 姓名 | 分工 |
| --- | --- | --- |
| 队长 / 全栈 | 宋天磊 | 架构设计、AI 引擎与 ReAct 编排、前端工作台 |
| 成员 | 许汉飞 | 自研 SVG 图表引擎、RAG 检索、端到端测试 |
| 成员 | 宋天磊 | UI 设计、技术文档、演示视频（兼任） |
| 指导教师 | 王士权 | 方案指导与质量把关 |

> 说明：本队共 2 名队员，宋天磊兼任「全栈开发」与「UI 设计 / 技术文档 / 演示视频」
> 两项分工，故在表中出现两次。



## 七、开源许可

MIT License（如竞赛规则有特殊要求，请以组委会章程为准）。
