import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{typeof value === "number" ? formatNumber(value) : value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
