import { LayoutDashboard, Settings, type LucideIcon } from "lucide-react";
import type { AppRole } from "@/features/auth/rbac";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Dashboard sidebar navigation per role.
 * Only routes that actually exist are listed — sections are added as each phase lands.
 */
export const DASHBOARD_NAV: Record<AppRole, NavGroup[]> = {
  CUSTOMER: [
    {
      label: "حساب من",
      items: [
        { href: "/dashboard/customer", label: "پیشخوان", icon: LayoutDashboard },
        { href: "/dashboard/customer/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
  PROVIDER: [
    {
      label: "پنل متخصص",
      items: [
        { href: "/dashboard/provider", label: "پیشخوان", icon: LayoutDashboard },
        { href: "/dashboard/provider/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
  ADMIN: [
    {
      label: "مدیریت",
      items: [
        { href: "/dashboard/admin", label: "پیشخوان", icon: LayoutDashboard },
        { href: "/dashboard/admin/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
};
