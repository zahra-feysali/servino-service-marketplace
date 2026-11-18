"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/logo";
import { DASHBOARD_NAV } from "@/features/dashboard/nav";
import { dashboardPathForRole, type AppRole } from "@/features/auth/rbac";

export function AppSidebar({ role, badges }: { role: AppRole; badges: { unread: number; messages: number } }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const home = dashboardPathForRole(role);

  const isActive = (href: string) => (href === home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <Sidebar side="right" dir="rtl" collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b px-4 group-data-[collapsible=icon]:px-2">
        <Logo href={home} className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
      </SidebarHeader>
      <SidebarContent>
        {DASHBOARD_NAV[role].map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge && badges[item.badge] > 0 ? (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground">
                        {badges[item.badge] > 99 ? "۹۹+" : badges[item.badge].toLocaleString("fa-IR")}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="صفحه اصلی سایت">
              <Link href="/">
                <Home />
                <span>صفحه اصلی سایت</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
