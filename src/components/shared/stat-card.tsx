import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

const TONES = {
  primary: "bg-secondary text-primary",
  amber: "bg-accent text-accent-foreground",
  green: "bg-success/12 text-success",
  violet: "bg-chart-4/12 text-chart-4",
  rose: "bg-destructive/10 text-destructive",
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <Card className="transition-shadow hover:shadow-lifted">
      <CardContent className="flex items-center gap-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-extrabold tracking-tight">{typeof value === "number" ? formatNumber(value) : value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
