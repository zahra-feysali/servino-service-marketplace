import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-secondary/60 to-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          بازگشت به صفحه اصلی
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center">{children}</main>
    </div>
  );
}
