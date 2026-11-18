import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, HandCoins, HeartHandshake, MessagesSquare, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import aboutTeam from "../../../../public/images/pages/about-team.webp";
import providerAtWork from "../../../../public/images/pages/provider-at-work.webp";

export const metadata: Metadata = {
  title: "درباره ما",
  description: "سروینو بازار آنلاین خدمات منزل و ساختمان است؛ مشتریان را به متخصصان تأییدشده و دارای اشتراک فعال وصل می‌کند.",
};

const VALUES = [
  { icon: BadgeCheck, title: "متخصصان تأییدشده", text: "مدارک و سوابق هر متخصص پیش از فعال‌شدن بررسی می‌شود و فقط متخصصان تأییدشده پیشنهاد می‌دهند." },
  { icon: HandCoins, title: "پرداخت امن و امانی", text: "مبلغ سفارش تا تأیید پایان کار نزد سروینو می‌ماند و در صورت لغو به کیف پول شما بازمی‌گردد." },
  { icon: MessagesSquare, title: "گفتگوی مستقیم", text: "پس از دریافت پیشنهاد، جزئیات کار را مستقیماً با متخصص هماهنگ کنید و عکس یا فایل بفرستید." },
  { icon: ShieldCheck, title: "حریم خصوصی", text: "نشانی و اطلاعات تماس شما فقط پس از انتخاب متخصص و برای همان سفارش نمایش داده می‌شود." },
];

const STEPS = [
  "درخواست خود را با فرم مخصوص هر خدمت ثبت می‌کنید.",
  "متخصصان مرتبط در شهر شما پیشنهاد قیمت و زمان می‌فرستند.",
  "پیشنهادها را مقایسه، با متخصص گفتگو و بهترین را انتخاب می‌کنید.",
  "پس از انجام کار و تأیید شما، امتیاز و نظرتان را ثبت می‌کنید.",
];

export default function AboutPage() {
  return (
    <div className="space-y-20 pb-20">
      <section className="border-b bg-gradient-to-b from-secondary/60 to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              درباره سروینو
            </span>
            <h1 className="text-3xl leading-tight font-extrabold text-balance sm:text-4xl">کار درست، با آدم درست — بدون دردسر پیدا کردن</h1>
            <p className="text-base leading-8 text-muted-foreground">
              سروینو یک بازار آنلاین خدمات منزل و ساختمان است. هدف ما ساده است: هر کسی بتواند در چند دقیقه برای تعمیر، نظافت، نصب یا
              اسباب‌کشی، از چند متخصص معتبر پیشنهاد بگیرد و با خیال راحت انتخاب کند.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/services">مشاهده خدمات</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register?role=provider">به‌عنوان متخصص بپیوندید</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <Image
              src={aboutTeam}
              alt="تیم پشتیبانی سروینو در حال هماهنگی درخواست‌های مشتریان"
              placeholder="blur"
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lifted"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="mb-8 max-w-2xl space-y-2">
          <h2 className="text-2xl font-bold">چرا سروینو؟</h2>
          <p className="text-muted-foreground">اعتماد در خدمات منزل مهم‌ترین چیز است؛ همه بخش‌های سروینو برای ساختن همین اعتماد طراحی شده‌اند.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <v.icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-semibold">{v.title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
        <Image
          src={providerAtWork}
          alt="متخصص سروینو در حال انجام کار فنی در منزل مشتری"
          placeholder="blur"
          sizes="(min-width: 1024px) 560px, 100vw"
          className="order-last aspect-[16/11] w-full rounded-3xl object-cover shadow-soft lg:order-first"
        />
        <div className="space-y-5">
          <h2 className="text-2xl font-bold">سروینو چطور کار می‌کند؟</h2>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {(i + 1).toLocaleString("fa-IR")}
                </span>
                <p className="pt-1 leading-7">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 md:flex-row md:items-center">
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <HeartHandshake className="size-7" aria-hidden />
              سؤالی دارید؟
            </h2>
            <p className="text-primary-foreground/85">تیم پشتیبانی سروینو آماده پاسخ‌گویی به پرسش‌ها و پیشنهادهای شماست.</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">تماس با ما</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
