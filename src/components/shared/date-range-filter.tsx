"use client";

import { Filter, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { JalaliDatePicker } from "@/components/shared/jalali-date-picker";

/**
 * GET filter with two Jalali pickers (`from`, `to` as Gregorian ISO in the URL).
 * Other current query parameters are preserved as hidden inputs; paging resets.
 */
export function DateRangeFilter({
  basePath,
  from,
  to,
  keep = {},
}: {
  basePath: string;
  from?: string;
  to?: string;
  keep?: Record<string, string | undefined>;
}) {
  const hasValue = !!(from || to);
  const clearHref = (() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  })();

  return (
    <form action={basePath} method="get" className="flex flex-wrap items-end gap-2" role="search" aria-label="فیلتر بازه تاریخ">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="grid gap-1 text-xs text-muted-foreground">
        از تاریخ
        <JalaliDatePicker name="from" defaultValue={from} className="w-44" placeholder="از تاریخ" />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        تا تاریخ
        <JalaliDatePicker name="to" defaultValue={to} className="w-44" placeholder="تا تاریخ" />
      </label>
      <Button type="submit" variant="outline">
        <Filter />
        اعمال
      </Button>
      {hasValue ? (
        <Button asChild variant="ghost">
          <Link href={clearHref}>
            <X />
            حذف فیلتر تاریخ
          </Link>
        </Button>
      ) : null}
    </form>
  );
}
