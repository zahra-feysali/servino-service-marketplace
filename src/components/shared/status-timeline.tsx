import { formatDateTime } from "@/lib/utils";

export type TimelineEntry = { id: string; label: string; note?: string | null; createdAt: Date };

export function StatusTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">سابقه‌ای ثبت نشده است.</p>;
  return (
    <ol className="relative space-y-4 border-s ps-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" aria-hidden />
          <p className="text-sm font-medium">{e.label}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
          {e.note ? <p className="mt-1 text-sm text-muted-foreground">{e.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
