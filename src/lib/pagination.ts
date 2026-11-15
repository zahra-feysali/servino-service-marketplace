/** Offset pagination helpers (pure). */

export const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

/** Parses `?page=` safely (positive integer, defaults to 1). */
export function parsePage(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PAGE) : 1;
}

export function pageArgs(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPaginated<T>(items: T[], total: number, page: number, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Builds `basePath?…&page=n` keeping the other (string) params. */
export function pageHref(basePath: string, params: Record<string, string | string[] | undefined>, page: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "page") q.set(k, v);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}
