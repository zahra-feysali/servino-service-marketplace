import Link from "next/link";
import { connection } from "next/server";
import { FlaskConical, Mail, Phone } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { DEFAULT_SETTINGS, getSiteSettings } from "@/features/admin/service";
import { getPublicCatalog } from "@/features/catalog/queries";

const COMPANY = [
  { href: "/about", label: "درباره ما" },
  { href: "/blog", label: "مجله سروینو" },
  { href: "/contact", label: "تماس با ما" },
  { href: "/providers", label: "متخصصان" },
];

const ACCOUNT = [
  { href: "/register", label: "ثبت‌نام مشتری" },
  { href: "/register?role=provider", label: "ثبت‌نام متخصصان" },
  { href: "/login", label: "ورود به حساب" },
];

function LinkColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title} className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="space-y-2.5 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="transition-colors hover:text-primary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function SiteFooter() {
  await connection(); // settings are read at request time, never at build time
  // The footer must render even if the database is unreachable.
  const [settings, catalog] = await Promise.all([
    getSiteSettings().catch(() => DEFAULT_SETTINGS),
    getPublicCatalog().catch(() => []),
  ]);
  const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date());
  const services = catalog.slice(0, 5).map((c) => ({ href: `/services#${c.slug}`, label: c.name }));
  const phone = settings["site.supportPhone"];
  const email = settings["site.supportEmail"];

  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4 sm:col-span-2 lg:col-span-1">
          <Logo />
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            سروینو مشتریان را به متخصصان تأییدشده متصل می‌کند؛ درخواست ثبت کنید، پیشنهادها را مقایسه کنید و با پرداخت امانی
            بهترین متخصص را انتخاب کنید.
          </p>
          {phone || email ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {phone ? (
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-primary" aria-hidden />
                  <a href={`tel:${phone}`} className="ltr-nums hover:text-primary" dir="ltr">
                    {phone}
                  </a>
                </li>
              ) : null}
              {email ? (
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-primary" aria-hidden />
                  <a href={`mailto:${email}`} className="hover:text-primary" dir="ltr">
                    {email}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        {services.length ? <LinkColumn title="خدمات" links={[...services, { href: "/services", label: "همه خدمات" }]} /> : null}
        <LinkColumn title="سروینو" links={COMPANY} />
        <LinkColumn title="حساب کاربری" links={ACCOUNT} />
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {year} {settings["site.name"]} — همه حقوق محفوظ است.
          </p>
          <p className="flex items-center gap-1.5 text-center">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            پرداخت‌ها در این نسخه شبیه‌سازی‌شده‌اند و تراکنش بانکی واقعی انجام نمی‌شود.
          </p>
        </div>
      </div>
    </footer>
  );
}
