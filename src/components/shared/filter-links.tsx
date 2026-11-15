import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Server-rendered filter chips that set a single query-string parameter. */
export function FilterLinks({
  basePath,
  param,
  current,
  options,
  extra,
}: {
  basePath: string;
  param: string;
  current: string | undefined;
  options: { value: string; label: string }[];
  /** other query params to preserve */
  extra?: Record<string, string | undefined>;
}) {
  const href = (value: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(extra ?? {})) if (v) q.set(k, v);
    if (value) q.set(param, value);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="flex flex-wrap gap-2" aria-label="فیلتر">
      {options.map((o) => (
        <Button key={o.value || "all"} asChild size="sm" variant={(current ?? "") === o.value ? "default" : "outline"}>
          <Link href={href(o.value)}>{o.label}</Link>
        </Button>
      ))}
    </nav>
  );
}

/** Reads a query param as a single string restricted to an allow-list. */
export function pickParam<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}
