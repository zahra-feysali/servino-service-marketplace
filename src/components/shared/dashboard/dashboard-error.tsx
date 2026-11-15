"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Error state rendered inside the dashboard shell (sidebar stays usable). */
export function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center" role="alert">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h2 className="font-semibold">بارگذاری این بخش با خطا مواجه شد</h2>
        <p className="max-w-md text-sm text-muted-foreground">لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، از بخش پشتیبانی تیکت ثبت کنید.</p>
        {error.digest ? <p className="text-xs text-muted-foreground ltr-nums">کد خطا: {error.digest}</p> : null}
      </div>
      <Button onClick={reset}>
        <RotateCcw />
        تلاش دوباره
      </Button>
    </div>
  );
}
