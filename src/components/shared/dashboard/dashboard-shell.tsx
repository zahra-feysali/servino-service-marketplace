import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/shared/dashboard/app-sidebar";
import { UserMenu } from "@/components/shared/dashboard/user-menu";
import { ROLE_LABELS } from "@/features/auth/rbac";
import type { CurrentUser } from "@/lib/authz";

const PANEL_TITLES = {
  CUSTOMER: "پنل مشتری",
  PROVIDER: "پنل متخصص",
  ADMIN: "پنل مدیریت",
} as const;

export function DashboardShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar role={user.role} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger aria-label="باز و بسته کردن منو" />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm font-medium">{PANEL_TITLES[user.role]}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">— {ROLE_LABELS[user.role]}</span>
          </div>
          <UserMenu name={user.fullName} role={user.role} />
        </header>
        <div className="flex-1 space-y-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
