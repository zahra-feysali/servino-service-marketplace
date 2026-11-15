import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { toPersianDigits } from "@/lib/utils";

export function SiteFooter() {
  const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date());
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm leading-7 text-muted-foreground">
            سروینو مشتریان را به متخصصان تأییدشده متصل می‌کند؛ درخواست خود را ثبت کنید، پیشنهادها را مقایسه کنید و
            بهترین متخصص را انتخاب کنید.
          </p>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">دسترسی سریع</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/services" className="hover:text-foreground">
                همه خدمات
              </Link>
            </li>
            <li>
              <Link href="/register?role=provider" className="hover:text-foreground">
                ثبت‌نام متخصصان
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                ورود به حساب
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">درباره پرداخت‌ها</h3>
          <p className="text-sm leading-7 text-muted-foreground">
            در این نسخه تمام پرداخت‌ها به‌صورت <strong>شبیه‌سازی‌شده</strong> انجام می‌شوند و هیچ تراکنش بانکی واقعی صورت
            نمی‌گیرد.
          </p>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {year} سروینو — نسخه {toPersianDigits("0.1")}
      </div>
    </footer>
  );
}
