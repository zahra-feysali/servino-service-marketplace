import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">صفحه پیدا نشد</h1>
        <p className="text-sm text-muted-foreground">صفحه‌ای که دنبال آن هستید وجود ندارد یا جابه‌جا شده است.</p>
      </div>
      <Button asChild>
        <Link href="/">بازگشت به صفحه اصلی</Link>
      </Button>
    </div>
  );
}
