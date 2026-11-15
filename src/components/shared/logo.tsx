import Link from "next/link";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-bold text-foreground", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Wrench className="size-5" aria-hidden />
      </span>
      <span className="text-lg tracking-tight">سروینو</span>
    </Link>
  );
}
