"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  addJalaliMonths,
  formatIsoAsJalaliLong,
  isIsoDateString,
  isoToJalali,
  jalaliMonthDays,
  jalaliMonthStartWeekday,
  jalaliToIso,
  todayIsoInTehran,
} from "@/lib/jalali";
import { cn, toPersianDigits } from "@/lib/utils";

type Props = {
  id?: string;
  /** Form field name: a hidden input carries the Gregorian ISO value (for FormData forms). */
  name?: string;
  /** Controlled ISO value (`YYYY-MM-DD`, Gregorian) — use with React Hook Form. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  /** Inclusive limits as Gregorian ISO dates. */
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  clearable?: boolean;
  className?: string;
};

/**
 * Persian (Jalali) date picker. Displays and selects Jalali dates; the value it emits/submits is a
 * Gregorian ISO date, so storage and server validation stay unchanged.
 */
export function JalaliDatePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  placeholder = "انتخاب تاریخ",
  invalid,
  clearable = true,
  className,
}: Props) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : inner;
  const selected = current && isIsoDateString(current) ? current : "";
  const today = useMemo(() => todayIsoInTehran(), []);
  const [open, setOpen] = useState(false);
  const initial = isoToJalali(selected || today);
  const [view, setView] = useState({ jy: initial.jy, jm: initial.jm });

  function select(iso: string) {
    if (value === undefined) setInner(iso);
    onChange?.(iso);
    setOpen(false);
  }

  const daysInMonth = jalaliMonthDays(view.jy, view.jm);
  const startPad = jalaliMonthStartWeekday(view.jy, view.jm);
  const cells: (number | null)[] = [...Array<null>(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const selectedParts = selected ? isoToJalali(selected) : null;

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            const j = isoToJalali(selected || today);
            setView({ jy: j.jy, jm: j.jm });
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid}
            aria-haspopup="dialog"
            className={cn("h-9 w-full justify-between gap-2 px-3 font-normal", !selected && "text-muted-foreground")}
          >
            <span className="truncate">{selected ? formatIsoAsJalaliLong(selected) : placeholder}</span>
            <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3" dir="rtl">
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="ماه قبل" onClick={() => setView(addJalaliMonths(view.jy, view.jm, -1))}>
              <ChevronRight />
            </Button>
            <p className="text-sm font-semibold" aria-live="polite">
              {JALALI_MONTHS[view.jm - 1]} {toPersianDigits(view.jy)}
            </p>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="ماه بعد" onClick={() => setView(addJalaliMonths(view.jy, view.jm, 1))}>
              <ChevronLeft />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="تقویم شمسی">
            {JALALI_WEEKDAYS_SHORT.map((w) => (
              <span key={w} className="py-1 text-xs font-medium text-muted-foreground" role="columnheader">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`pad-${i}`} />;
              const iso = jalaliToIso(view.jy, view.jm, d)!;
              const disabled = (min && iso < min) || (max && iso > max);
              const isSelected = selectedParts && selectedParts.jy === view.jy && selectedParts.jm === view.jm && selectedParts.jd === d;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!!disabled}
                  onClick={() => select(iso)}
                  aria-pressed={!!isSelected}
                  aria-label={formatIsoAsJalaliLong(iso)}
                  className={cn(
                    "flex size-8 items-center justify-center justify-self-center rounded-lg text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    isToday && !isSelected && "font-bold text-primary ring-1 ring-primary/40",
                    disabled && "pointer-events-none opacity-30",
                  )}
                >
                  {toPersianDigits(d)}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => select(today)} disabled={!!((min && today < min) || (max && today > max))}>
              امروز
            </Button>
            {clearable && selected ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => select("")}>
                <X />
                پاک کردن
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
