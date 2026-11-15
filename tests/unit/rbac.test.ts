import { describe, expect, it } from "vitest";
import {
  dashboardPathForRole,
  hasRole,
  isAppRole,
  isSafeRelativePath,
  resolvePostLoginRedirect,
} from "@/features/auth/rbac";
import { DASHBOARD_NAV } from "@/features/dashboard/nav";

describe("role helpers", () => {
  it("validates role values", () => {
    expect(isAppRole("ADMIN")).toBe(true);
    expect(isAppRole("SUPERUSER")).toBe(false);
    expect(isAppRole(undefined)).toBe(false);
  });

  it("checks allowed roles", () => {
    expect(hasRole("ADMIN", ["ADMIN"])).toBe(true);
    expect(hasRole("CUSTOMER", ["ADMIN", "PROVIDER"])).toBe(false);
    expect(hasRole(null, ["CUSTOMER"])).toBe(false);
  });

  it("maps each role to its own dashboard", () => {
    expect(dashboardPathForRole("CUSTOMER")).toBe("/dashboard/customer");
    expect(dashboardPathForRole("PROVIDER")).toBe("/dashboard/provider");
    expect(dashboardPathForRole("ADMIN")).toBe("/dashboard/admin");
  });
});

describe("redirect safety", () => {
  it("only accepts same-origin relative paths", () => {
    expect(isSafeRelativePath("/services")).toBe(true);
    expect(isSafeRelativePath("//evil.com")).toBe(false);
    expect(isSafeRelativePath("/\\evil.com")).toBe(false);
    expect(isSafeRelativePath("https://evil.com")).toBe(false);
    expect(isSafeRelativePath(undefined)).toBe(false);
  });

  it("never redirects a user into another role's dashboard", () => {
    expect(resolvePostLoginRedirect("/dashboard/admin", "CUSTOMER")).toBe("/dashboard/customer");
    expect(resolvePostLoginRedirect("/dashboard/admin/users", "PROVIDER")).toBe("/dashboard/provider");
    expect(resolvePostLoginRedirect("/dashboard/customer/settings", "CUSTOMER")).toBe("/dashboard/customer/settings");
  });

  it("falls back to the own dashboard for unsafe or auth paths", () => {
    expect(resolvePostLoginRedirect("https://evil.com", "ADMIN")).toBe("/dashboard/admin");
    expect(resolvePostLoginRedirect("/login", "ADMIN")).toBe("/dashboard/admin");
    expect(resolvePostLoginRedirect(null, "PROVIDER")).toBe("/dashboard/provider");
    expect(resolvePostLoginRedirect("/services/plumbing", "CUSTOMER")).toBe("/services/plumbing");
  });
});

describe("dashboard navigation", () => {
  it("only links each role to paths inside its own dashboard", () => {
    for (const [role, groups] of Object.entries(DASHBOARD_NAV)) {
      const base = dashboardPathForRole(role as "CUSTOMER" | "PROVIDER" | "ADMIN");
      for (const item of groups.flatMap((g) => g.items)) {
        expect(item.href === base || item.href.startsWith(`${base}/`)).toBe(true);
      }
    }
  });
});
