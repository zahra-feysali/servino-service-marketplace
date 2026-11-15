/**
 * Pure role-based access helpers (no I/O) — shared by server guards, UI and tests.
 * Security decisions always use the role loaded from the database (src/lib/authz.ts).
 */

export const ROLES = ["CUSTOMER", "PROVIDER", "ADMIN"] as const;
export type AppRole = (typeof ROLES)[number];

export const DASHBOARD_PATHS: Record<AppRole, string> = {
  CUSTOMER: "/dashboard/customer",
  PROVIDER: "/dashboard/provider",
  ADMIN: "/dashboard/admin",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasRole(role: AppRole | null | undefined, allowed: readonly AppRole[]): boolean {
  return !!role && allowed.includes(role);
}

export function dashboardPathForRole(role: AppRole): string {
  return DASHBOARD_PATHS[role];
}

/** True for same-origin relative paths only (rejects `//evil.com`, `/\evil.com`, absolute URLs). */
export function isSafeRelativePath(raw: string | null | undefined): raw is string {
  return !!raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\");
}

/**
 * Post-login redirect target. Only same-origin relative paths are accepted
 * (open-redirect protection), and a dashboard path of another role is replaced
 * by the user's own dashboard.
 */
export function resolvePostLoginRedirect(raw: string | null | undefined, role: AppRole): string {
  const own = dashboardPathForRole(role);
  if (!isSafeRelativePath(raw)) return own;
  if (raw.startsWith("/dashboard")) {
    return raw === own || raw.startsWith(`${own}/`) ? raw : own;
  }
  if (raw.startsWith("/login") || raw.startsWith("/register") || raw.startsWith("/api")) return own;
  return raw;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  CUSTOMER: "مشتری",
  PROVIDER: "متخصص",
  ADMIN: "مدیر سیستم",
};
