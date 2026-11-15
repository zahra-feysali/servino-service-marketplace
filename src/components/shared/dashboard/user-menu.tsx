"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, dashboardPathForRole, type AppRole } from "@/features/auth/rbac";

export function UserMenu({ name, role }: { name: string; role: AppRole }) {
  const initials = name.trim().slice(0, 1);

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-secondary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm sm:inline">{name}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate font-medium">{name}</p>
          <p className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${dashboardPathForRole(role)}/settings`}>
            <Settings />
            تنظیمات حساب
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut({ callbackUrl: "/" })}>
          <LogOut />
          خروج از حساب
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
