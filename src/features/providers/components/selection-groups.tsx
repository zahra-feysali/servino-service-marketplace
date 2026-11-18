"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toPersianDigits } from "@/lib/utils";

type Group = { id: string; title: string; items: { id: string; label: string }[] };

/**
 * Grouped checkbox tiles for long multi-selects (provider services and cities): live counts,
 * select-all / clear per group, optional search, and generous touch targets. Plain checkbox
 * inputs, so the surrounding ServerForm submits them as `name` values.
 */
export function SelectionGroups({
  name,
  groups,
  selected: initial,
  max,
  searchPlaceholder,
  unit,
}: {
  name: string;
  groups: Group[];
  selected: string[];
  max: number;
  searchPlaceholder?: string;
  unit: string;
}) {
  const [selected, setSelected] = useState(() => new Set(initial));
  const [query, setQuery] = useState("");
  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  const q = query.trim();

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setGroup = (g: Group, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of g.items) {
        if (on) next.add(i.id);
        else next.delete(i.id);
      }
      return next;
    });

  const over = selected.size > max;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={cn("text-sm", over ? "font-medium text-destructive" : "text-muted-foreground")} aria-live="polite">
          {toPersianDigits(selected.size)} {unit} انتخاب شده
          {over ? ` — حداکثر ${toPersianDigits(max)} ${unit} مجاز است.` : ` (حداکثر ${toPersianDigits(max)})`}
        </p>
        {total > 12 ? (
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? "جستجو…"}
              aria-label={searchPlaceholder ?? "جستجو"}
              className="ps-9"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {groups.map((g) => {
          const visible = q ? g.items.filter((i) => i.label.includes(q)) : g.items;
          const count = g.items.filter((i) => selected.has(i.id)).length;
          return (
            <fieldset key={g.id} className={cn("rounded-2xl border bg-muted/20 p-4", q && visible.length === 0 && "hidden")}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <legend className="contents">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {g.title}
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      {toPersianDigits(count)} از {toPersianDigits(g.items.length)}
                    </span>
                  </span>
                </legend>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setGroup(g, true)} disabled={count === g.items.length}>
                    انتخاب همه
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setGroup(g, false)} disabled={count === 0}>
                    حذف همه
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((i) => {
                  const on = selected.has(i.id);
                  return (
                    <label
                      key={i.id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/50",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
                        on && "border-primary bg-primary/5 font-medium",
                        q && !i.label.includes(q) && "hidden",
                      )}
                    >
                      <input type="checkbox" name={name} value={i.id} checked={on} onChange={(e) => toggle(i.id, e.target.checked)} className="peer sr-only" />
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                        )}
                        aria-hidden
                      >
                        {on ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
