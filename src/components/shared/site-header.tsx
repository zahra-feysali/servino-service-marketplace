import Link from "next/link";
import { LayoutDashboard, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { MobileNav } from "@/components/shared/mobile-nav";
import { PUBLIC_NAV } from "@/components/shared/public-nav";
import { getCurrentUserSafe } from "@/features/auth/current-user-safe";

export async function SiteHeader() {
  // Header must still render if the database is temporarily unreachable.
  const user = await getCurrentUserSafe();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="ناوبری اصلی">
            {PUBLIC_NAV.map((item) => (
              <Button key={item.href} asChild variant="ghost" size="sm">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button asChild>
              <Link href="/dashboard">
                <LayoutDashboard />
                داشبورد
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">
                  <LogIn />
                  ورود
                </Link>
              </Button>
              <Button asChild>
                <Link href="/register">
                  <UserPlus />
                  ثبت‌نام
                </Link>
              </Button>
            </>
          )}
        </div>

        <MobileNav isAuthenticated={!!user} />
      </div>
    </header>
  );
}
