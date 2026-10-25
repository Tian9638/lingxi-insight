"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("页面错误：", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">页面出现了一点问题</h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-500">
        错误信息：{error.message || "未知错误"}
        {error.digest ? `（${error.digest}）` : ""}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>重新加载</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/")}>
          返回首页
        </Button>
      </div>
    </div>
  );
}
