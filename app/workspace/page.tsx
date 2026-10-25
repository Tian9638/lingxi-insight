import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = {
  title: "工作台",
  description: "对话式数据分析工作台：自然语言提问，AI Agent 自动查询、可视化并生成洞察。",
};

export default function WorkspacePage() {
  return <Workspace />;
}
