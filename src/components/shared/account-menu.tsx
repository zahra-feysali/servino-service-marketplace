"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LayoutDashboard, LogOut, MessagesSquare, Settings, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROLE_LABELS, dashboardPathForRole, type AppRole } from "@/features/auth/rbac";

type Props = { name: string; role: AppRole; avatarUrl: string | null };

/**
 * Account menu for the site header and the dashboard top bar (desktop and mobile):
 * avatar + name + role in the trigger (avatar only on small screens), and quick links.
 */
export function AccountMenu({ name, role, avatarUrl }: Props) {
  const base = dashboardPathForRole(role);
  const profileHref = role === "PROVIDER" ? `${base}/profile` : `${base}/settings`;

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 rounded-full px-1.5 sm:pe-3" aria-label={`حساب کاربری ${name}`}>
          <UserAvatar name={name} src={avatarUrl} size="sm" />
          <span className="hidden min-w-0 flex-col items-start text-start leading-tight sm:flex">
            <span className="max-w-32 truncate text-sm font-medium">{name}</span>
            <span className="text-[0.7rem] font-normal text-muted-foreground">{ROLE_LABELS[role]}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <UserAvatar name={name} src={avatarUrl} size="md" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{name}</span>
            <span className="block text-xs font-normal text-muted-foreground">{ROLE_LABELS[role]}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={base}>
              <LayoutDashboard />
              داشبورد
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={profileHref}>
              <UserRound />
              پروفایل من
            </Link>
          </DropdownMenuItem>
          {role !== "ADMIN" ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={`${base}/messages`}>
                  <MessagesSquare />
                  پیام‌ها
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`${base}/wallet`}>
                  <Wallet />
                  کیف پول
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`${base}/settings`}>
              <Settings />
              تنظیمات حساب
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut({ callbackUrl: "/" })}>
          <LogOut />
          خروج از حساب
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
