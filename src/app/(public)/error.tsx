"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">خطایی رخ داد</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          در بارگذاری این صفحه مشکلی پیش آمد. ممکن است اتصال به پایگاه داده برقرار نباشد. لطفاً دوباره تلاش کنید.
        </p>
        {error.digest ? <p className="text-xs text-muted-foreground ltr-nums">کد خطا: {error.digest}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw />
          تلاش دوباره
        </Button>
        <Button asChild variant="outline">
          <Link href="/">صفحه اصلی</Link>
        </Button>
      </div>
    </div>
  );
}
