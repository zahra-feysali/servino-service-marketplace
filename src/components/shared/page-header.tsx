import type { LucideIcon } from "lucide-react";

/** Consistent page title block used by every dashboard and public listing page. */
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary sm:flex">
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-extrabold tracking-tight break-words text-foreground sm:text-2xl">{title}</h1>
          {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
