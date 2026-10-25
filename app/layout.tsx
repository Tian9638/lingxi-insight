import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "灵犀洞察 — AI 原生对话式数据分析平台",
    template: "%s · 灵犀洞察",
  },
  description:
    "灵犀洞察是一款 AI 原生的对话式数据分析平台：上传数据，用自然语言提问，AI Agent 自动完成查询、聚合、可视化与洞察报告生成。全国高校 AI Web 开发挑战赛参赛作品。",
  keywords: [
    "AI Web 应用",
    "对话式数据分析",
    "AI Agent",
    "RAG",
    "Next.js",
    "数据可视化",
  ],
  authors: [{ name: "灵犀洞察团队" }],
  openGraph: {
    title: "灵犀洞察 — AI 原生对话式数据分析平台",
    description: "与数据对话，让洞察自然流动。AI Agent 驱动的对话式数据分析。",
    type: "website",
    locale: "zh_CN",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">{children}</body>
    </html>
  );
}
