import {
  BadgeCheck,
  BadgeDollarSign,
  Bell,
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  FolderTree,
  Images,
  Inbox,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MapPin,
  Megaphone,
  Newspaper,
  MessageSquareText,
  MessagesSquare,
  PackageCheck,
  Receipt,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserCog,
  UserRound,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/features/auth/rbac";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "unread" | "messages" };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Dashboard sidebar navigation per role.
 * Only routes that actually exist are listed.
 */
export const DASHBOARD_NAV: Record<AppRole, NavGroup[]> = {
  CUSTOMER: [
    {
      label: "خدمات من",
      items: [
        { href: "/dashboard/customer", label: "پیشخوان", icon: LayoutDashboard },
        { href: "/dashboard/customer/requests", label: "درخواست‌ها و پیشنهادها", icon: ClipboardList },
        { href: "/dashboard/customer/orders", label: "سفارش‌های من", icon: PackageCheck },
        { href: "/dashboard/customer/messages", label: "پیام‌ها", icon: MessagesSquare, badge: "messages" },
        { href: "/dashboard/customer/reviews", label: "نظرات من", icon: MessageSquareText },
      ],
    },
    {
      label: "حساب",
      items: [
        { href: "/dashboard/customer/wallet", label: "کیف پول", icon: Wallet },
        { href: "/dashboard/customer/addresses", label: "نشانی‌ها", icon: MapPin },
        { href: "/dashboard/customer/notifications", label: "اعلان‌ها", icon: Bell, badge: "unread" },
        { href: "/dashboard/customer/tickets", label: "پشتیبانی", icon: LifeBuoy },
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
        { href: "/dashboard/provider/messages", label: "پیام‌ها", icon: MessagesSquare, badge: "messages" },
        { href: "/dashboard/provider/reviews", label: "نظرات مشتریان", icon: Star },
      ],
    },
    {
      label: "پروفایل حرفه‌ای",
      items: [
        { href: "/dashboard/provider/profile", label: "پروفایل و مهارت‌ها", icon: UserRound },
        { href: "/dashboard/provider/services", label: "خدمات و مناطق", icon: Wrench },
        { href: "/dashboard/provider/portfolio", label: "نمونه‌کارها", icon: Images },
        { href: "/dashboard/provider/documents", label: "مدارک و گواهی‌ها", icon: FileText },
      ],
    },
    {
      label: "مالی",
      items: [
        { href: "/dashboard/provider/subscription", label: "اشتراک", icon: CreditCard },
        { href: "/dashboard/provider/wallet", label: "کیف پول و پرداخت‌ها", icon: Wallet },
        { href: "/dashboard/provider/earnings", label: "درآمد", icon: BadgeDollarSign },
      ],
    },
    {
      label: "حساب",
      items: [
        { href: "/dashboard/provider/notifications", label: "اعلان‌ها", icon: Bell, badge: "unread" },
        { href: "/dashboard/provider/tickets", label: "پشتیبانی", icon: LifeBuoy },
        { href: "/dashboard/provider/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
  ADMIN: [
    {
      label: "عمومی",
      items: [
        { href: "/dashboard/admin", label: "پیشخوان و گزارش‌ها", icon: BarChart3 },
        { href: "/dashboard/admin/customers", label: "مشتریان", icon: Users },
        { href: "/dashboard/admin/providers", label: "متخصصان و تأیید", icon: UserCog },
      ],
    },
    {
      label: "بازار",
      items: [
        { href: "/dashboard/admin/catalog", label: "خدمات و فرم‌ها", icon: FolderTree },
        { href: "/dashboard/admin/requests", label: "درخواست‌ها و پیشنهادها", icon: ClipboardList },
        { href: "/dashboard/admin/orders", label: "سفارش‌ها", icon: PackageCheck },
        { href: "/dashboard/admin/reviews", label: "نظرات", icon: MessageSquareText },
        { href: "/dashboard/admin/featured", label: "متخصصان ویژه", icon: Sparkles },
      ],
    },
    {
      label: "محتوا",
      items: [{ href: "/dashboard/admin/blog", label: "بلاگ و مقاله‌ها", icon: Newspaper }],
    },
    {
      label: "مالی",
      items: [
        { href: "/dashboard/admin/finance", label: "مالی و کمیسیون", icon: Landmark },
        { href: "/dashboard/admin/plans", label: "پلن‌ها و اشتراک‌ها", icon: BadgeCheck },
        { href: "/dashboard/admin/payments", label: "پرداخت‌ها و تراکنش‌ها", icon: Receipt },
      ],
    },
    {
      label: "پشتیبانی و سیستم",
      items: [
        { href: "/dashboard/admin/tickets", label: "تیکت‌ها", icon: LifeBuoy },
        { href: "/dashboard/admin/contact", label: "پیام‌های تماس", icon: Mail },
        { href: "/dashboard/admin/broadcast", label: "ارسال اعلان", icon: Megaphone },
        { href: "/dashboard/admin/site-settings", label: "تنظیمات سایت", icon: SlidersHorizontal },
        { href: "/dashboard/admin/notifications", label: "اعلان‌های من", icon: Bell, badge: "unread" },
        { href: "/dashboard/admin/settings", label: "تنظیمات حساب", icon: Settings },
      ],
    },
  ],
};
