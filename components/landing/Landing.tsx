"use client";

/**
 * 落地页：产品介绍 + 能力矩阵 + 工作原理 + 技术架构
 */

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Database,
  FileText,
  Github,
  Lightbulb,
  LineChart,
  Mic,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Badge, Button, Card, Logo } from "@/components/ui";

// ---------- 导航 ----------

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          <a href="#features" className="transition-colors hover:text-brand-700">
            核心能力
          </a>
          <a href="#how" className="transition-colors hover:text-brand-700">
            工作原理
          </a>
          <a href="#architecture" className="transition-colors hover:text-brand-700">
            技术架构
          </a>
          <a href="#stack" className="transition-colors hover:text-brand-700">
            技术栈
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/workspace">
            <Button size="sm">
              进入工作台
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------- Hero ----------

const DEMO_LINE = [38, 42, 40, 51, 47, 58, 63, 60, 71, 68, 76, 82];

function MiniChart() {
  const w = 300;
  const h = 96;
  const max = Math.max(...DEMO_LINE);
  const min = Math.min(...DEMO_LINE);
  const pts = DEMO_LINE.map((v, i) => ({
    x: (i / (DEMO_LINE.length - 1)) * (w - 16) + 8,
    y: h - 12 - ((v - min) / (max - min || 1)) * (h - 30),
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full">
      <defs>
        <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w - 8} ${h - 12} L 8 ${h - 12} Z`} fill="url(#hero-area)" />
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" className="chart-line-anim" pathLength={1} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 0} fill="#4f46e5" />
      ))}
    </svg>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand-100/50 blur-3xl" />
        <div className="absolute right-0 top-40 h-64 w-64 rounded-full bg-violet-100/40 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <Badge tone="brand" className="mb-5">
            <Sparkles className="h-3 w-3" />
            全国高校 AI Web 开发挑战赛 · 参赛作品
          </Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 lg:text-5xl">
            与数据对话，
            <br />
            让<span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">洞察</span>
            自然流动
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
            灵犀洞察是一款 AI 原生的对话式数据分析平台。上传数据，用自然语言提问，
            AI Agent 自动完成查询、聚合、图表推荐与洞察报告生成——全程思考过程透明可见。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/workspace">
              <Button size="lg">
                免费进入工作台
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how">
              <Button variant="secondary" size="lg">
                观看工作原理
              </Button>
            </a>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-slate-200 pt-6">
            {[
              { k: "3 套", v: "内置示例数据集" },
              { k: "10+", v: "分析意图识别" },
              { k: "100%", v: "本地可运行" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="text-xl font-bold text-slate-900">{s.k}</dt>
                <dd className="mt-0.5 text-xs text-slate-500">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 动态演示对话 */}
        <div className="relative">
          <div className="animate-floaty rounded-2xl border border-slate-200 bg-white p-4 shadow-glow">
            <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600">
                <Sparkles className="h-3 w-3 text-white" />
              </span>
              <span className="text-xs font-medium text-slate-600">灵犀洞察 · 演示</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                实时流式
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="demo-msg demo-msg-1 ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2 text-xs text-white">
                近30天销售额的趋势如何？
              </div>
              <div className="demo-msg demo-msg-2 w-fit max-w-[92%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">总销售额 ¥286.4万</span>
                ，较上一周期
                <span className="font-semibold text-red-600"> +12.4%</span>
                ，整体呈温和上升。峰值出现在 6月18日…
              </div>
              <div className="demo-msg demo-msg-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">「销售额」近30天走势</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-medium text-brand-600">
                    AI 推荐图表
                  </span>
                </div>
                <MiniChart />
              </div>
              <div className="demo-msg demo-msg-4 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2">
                <Brain className="h-3.5 w-3.5 text-brand-400" />
                <span className="text-[10px] text-slate-300">
                  Agent：规划 → query_data → recommend_chart → 生成解读
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 核心能力 ----------

const FEATURES = [
  {
    icon: BarChart3,
    title: "对话式分析",
    desc: "自然语言直达分组聚合查询：趋势、占比、排名、对比、相关性、异常、预测，10+ 意图自动识别。",
    tag: "AI 技术深度",
  },
  {
    icon: Workflow,
    title: "Agent 透明协作",
    desc: "ReAct 循环实时可见：规划 → 工具调用 → 观察 → 生成。每个工具的参数、耗时与结果全程可审计。",
    tag: "创新性",
  },
  {
    icon: BookOpen,
    title: "RAG 知识库",
    desc: "文档自动切片、TF-IDF 向量化、余弦相似度检索，回答附带可溯源引用与相关度评分。",
    tag: "AI 技术深度",
  },
  {
    icon: Mic,
    title: "多模态交互",
    desc: "语音输入（Web Speech API 实时转写）、流式文本渲染、思考状态可视化、随时中断生成。",
    tag: "用户体验",
  },
  {
    icon: LineChart,
    title: "纯 SVG 图表引擎",
    desc: "自研零依赖图表引擎：折线 / 柱状 / 条形 / 环形 / 散点，支持预测虚线、异常标注与入场动画。",
    tag: "前端工程质量",
  },
  {
    icon: Shield,
    title: "安全与可控",
    desc: "输入护栏、输出兜底、检索阈值回退、真实模型通道异常自动降级，敏感信息环境变量化。",
    tag: "AI 安全可控",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 text-center">
        <Badge tone="slate" className="mb-3">
          核心能力
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          一个平台，覆盖数据分析全链路
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
          从数据接入到洞察交付，每个环节都由 AI 驱动，且每个环节都透明可审计。
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card
            key={f.title}
            className="group p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <Badge tone="violet">{f.tag}</Badge>
            </div>
            <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------- 工作原理 ----------

const STEPS = [
  {
    icon: Database,
    title: "接入数据",
    desc: "三套内置示例数据集（电商销售 / 空气质量 / 学习行为），或上传 CSV 自动推断列类型，支持 5000 行。",
  },
  {
    icon: Sparkles,
    title: "自然语言提问",
    desc: "「近30天销售额趋势如何？」「各品类占比？」支持语音输入，AI 自动解析指标、维度、时间范围与过滤条件。",
  },
  {
    icon: Lightbulb,
    title: "获得洞察",
    desc: "流式解读 + 智能图表 + 关键指标卡 + 一键导出 Markdown 报告，全过程思考链路实时可见。",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-y border-slate-200 bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <Badge tone="slate" className="mb-3">
            工作原理
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">三步完成一次专业分析</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative">
              <Card className="h-full p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="text-3xl font-bold text-slate-200">0{i + 1}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 技术架构 ----------

const ARCH_LAYERS = [
  {
    title: "用户界面层",
    tech: "Next.js 14 App Router · React 18 · TypeScript · Tailwind CSS",
    items: ["对话式工作台", "纯 SVG 图表引擎", "Agent 追踪面板", "响应式三栏布局"],
    color: "from-brand-500 to-brand-600",
  },
  {
    title: "交互协议层",
    tech: "SSE（Server-Sent Events）· 统一 AgentEvent 事件协议",
    items: ["meta / plan", "tool_call / tool_result", "text 增量流", "usage / done"],
    color: "from-violet-500 to-violet-600",
  },
  {
    title: "AI 引擎层",
    tech: "ReAct 编排 · 意图理解 · 工具调用 · RAG · 安全护栏 · 可替换 Provider",
    items: ["本地演示引擎", "OpenAI 兼容通道", "Function Calling", "异常自动回退"],
    color: "from-sky-500 to-sky-600",
  },
  {
    title: "数据层",
    tech: "内存数据集 · CSV 解析与类型推断 · TF-IDF 倒排索引",
    items: ["结构化查询聚合", "Z-Score 异常检测", "线性趋势预测", "文档切片检索"],
    color: "from-emerald-500 to-emerald-600",
  },
];

function Architecture() {
  return (
    <section id="architecture" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 text-center">
        <Badge tone="slate" className="mb-3">
          技术架构
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">分层解耦，通道可替换</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
          AI 引擎通过统一事件协议与前端通信；「本地演示引擎」与「真实大模型通道」
          共享同一套工具层，配置 API Key 即可无缝切换。
        </p>
      </div>
      <div className="space-y-3">
        {ARCH_LAYERS.map((layer, i) => (
          <div key={layer.title} className="relative">
            <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${layer.color} text-lg font-bold text-white shadow-sm`}>
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{layer.title}</h3>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                    {layer.tech}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {layer.items.map((it) => (
                    <span
                      key={it}
                      className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-500"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
            {i < ARCH_LAYERS.length - 1 && (
              <div className="flex justify-center py-0.5">
                <div className="h-3 w-3 rotate-45 border-b border-r border-slate-300" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- 技术栈 ----------

const STACK = [
  "Next.js 14",
  "React 18",
  "TypeScript",
  "Tailwind CSS",
  "Zustand",
  "SSE 流式协议",
  "纯 SVG 图表",
  "PapaParse",
  "Web Speech API",
  "TF-IDF / RAG",
  "Function Calling",
  "lucide-react",
];

function Stack() {
  return (
    <section id="stack" className="border-t border-slate-200 bg-white py-16">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">技术栈</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          全部基于竞赛推荐的主流前端技术体系构建，无重型运行时依赖。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {STACK.map((s) => (
            <span
              key={s}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xs text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- CTA + Footer ----------

function CtaFooter() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Card className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-violet-700 px-8 py-14 text-center">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl font-bold tracking-tight text-white">
            现在开始你的第一次对话式分析
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            无需注册，无需 API Key，三套示例数据开箱即用。配置真实模型 Key 后，
            同一界面即刻升级为生产级 AI 分析助手。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/workspace">
              <Button size="lg" variant="secondary" className="bg-white text-brand-700 hover:bg-brand-50">
                进入工作台
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <Button
                size="lg"
                variant="ghost"
                className="text-white ring-1 ring-inset ring-white/30 hover:bg-white/10"
              >
                <Github className="h-4 w-4" />
                查看源码
              </Button>
            </a>
          </div>
        </Card>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-slate-400 md:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="scale-90" />
          </div>
          <p className="text-center leading-relaxed">
            灵犀洞察 · 为「全国高校 AI Web 开发挑战赛」而作 ·
            AI 原生对话式数据分析平台
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              作品文档见仓库 README
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Architecture />
      <Stack />
      <CtaFooter />
    </div>
  );
}
