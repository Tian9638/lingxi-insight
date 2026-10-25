import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="text-xl font-bold text-slate-900">页面不存在</h1>
      <p className="max-w-md text-sm text-slate-500">
        你访问的页面可能已被移动或删除。可以返回首页，或直接进入工作台开始分析。
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button>返回首页</Button>
        </Link>
        <Link href="/workspace">
          <Button variant="secondary">进入工作台</Button>
        </Link>
      </div>
    </div>
  );
}
