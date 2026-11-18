import { toPersianDigits } from "@/lib/utils";

/** Accessible upload progress bar. */
export function UploadProgress({ percent, label = "پیشرفت بارگذاری" }: { percent: number; label?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="space-y-1" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{p < 100 ? label : "در حال پردازش…"}</span>
        <span>{toPersianDigits(p)}٪</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
