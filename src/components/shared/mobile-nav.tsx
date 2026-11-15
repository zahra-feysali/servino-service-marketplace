"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PUBLIC_NAV as LINKS } from "@/components/shared/public-nav";

export function MobileNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="باز کردن منو">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>منو</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label="ناوبری موبایل">
          {LINKS.map((l) => (
            <Button key={l.href} asChild variant="ghost" className="justify-start">
              <Link href={l.href} onClick={close}>
                {l.label}
              </Link>
            </Button>
          ))}
          <Separator className="my-2" />
          {isAuthenticated ? (
            <Button asChild>
              <Link href="/dashboard" onClick={close}>
                داشبورد
              </Link>
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline">
                <Link href="/login" onClick={close}>
                  ورود
                </Link>
              </Button>
              <Button asChild>
                <Link href="/register" onClick={close}>
                  ثبت‌نام
                </Link>
              </Button>
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
