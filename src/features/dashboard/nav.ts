import {
  Bell,
  ClipboardList,
  FolderTree,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  PackageCheck,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/features/auth/rbac";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "unread" };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Dashboard sidebar navigation per role.
 * Only routes that actually exist are listed — sections are added as each phase lands.
 */
export const DASHBOARD_NAV: Record<AppRole, NavGroup[]> = {
  CUSTOMER: [
    {
      label: "خدمات من",
      items: [
        { href: "/dashboard/customer", label: "پیشخوان", icon: LayoutDashboard },
        { href: "/dashboard/customer/requests", label: "درخواست‌های من", icon: ClipboardList },
        { href: "/dashboard/customer/orders", label: "سفارش‌های من", icon: PackageCheck },
        { href: "/dashboard/customer/reviews", label: "نظرات من", icon: MessageSquareText },
      ],
    },
    {
      label: "حساب",
      items: [
        { href: "/dashboard/customer/notifications", label: "اعلان‌ها", icon: Bell, badge: "unread" },
        { href: "/dashboard/customer/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
  PROVIDER: [
    {
      label: "کار و سفارش",
      items: [
        { href: "/dashboard/provider", label: "پیشخوان", icon: LayoutDashboard },
        { href: "/dashboard/provider/requests", label: "درخواست‌های مرتبط", icon: Inbox },
        { href: "/dashboard/provider/offers", label: "پیشنهادهای من", icon: Send },
        { href: "/dashboard/provider/orders", label: "سفارش‌های دریافتی", icon: PackageCheck },
      ],
    },
    {
      label: "حساب",
      items: [
        { href: "/dashboard/provider/notifications", label: "اعلان‌ها", icon: Bell, badge: "unread" },
        { href: "/dashboard/provider/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
  ADMIN: [
    {
      label: "مدیریت",
      items: [
        { href: "/dashboard/admin", label: "پیشخوان", icon: LayoutDashboard },
        { href: "/dashboard/admin/catalog", label: "خدمات و فرم‌ها", icon: FolderTree },
      ],
    },
    {
      label: "حساب",
      items: [
        { href: "/dashboard/admin/notifications", label: "اعلان‌ها", icon: Bell, badge: "unread" },
        { href: "/dashboard/admin/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
};
