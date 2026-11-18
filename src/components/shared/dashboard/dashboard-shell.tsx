import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/shared/dashboard/app-sidebar";
import { AccountMenu } from "@/components/shared/account-menu";
import { ROLE_LABELS, dashboardPathForRole } from "@/features/auth/rbac";
import { countUnread } from "@/features/notifications/service";
import { countUnreadMessages } from "@/features/chat/service";
import type { CurrentUser } from "@/lib/authz";

const PANEL_TITLES = {
  CUSTOMER: "پنل مشتری",
  PROVIDER: "پنل متخصص",
  ADMIN: "پنل مدیریت",
} as const;

export async function DashboardShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const [unread, messages] = await Promise.all([countUnread(user.id), user.role === "ADMIN" ? 0 : countUnreadMessages(user.id)]);

  return (
    <SidebarProvider>
      <AppSidebar role={user.role} badges={{ unread, messages }} />
      <SidebarInset id="main">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-card/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger aria-label="باز و بسته کردن منو" />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm font-medium">{PANEL_TITLES[user.role]}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">— {ROLE_LABELS[user.role]}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="relative" aria-label={`اعلان‌ها${unread ? ` (${unread} خوانده‌نشده)` : ""}`}>
              <Link href={`${dashboardPathForRole(user.role)}/notifications`}>
                <Bell className="size-5" />
                {unread > 0 ? (
                  <span className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">
                    {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
                  </span>
                ) : null}
              </Link>
            </Button>
            <AccountMenu name={user.fullName} role={user.role} avatarUrl={user.avatarUrl} />
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
