import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardList,
  HandCoins,
  MessagesSquare,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ServiceIcon } from "@/components/shared/service-icon";
import { getPublicCatalog, servicesOfCategory } from "@/features/catalog/queries";
import { BlogPostCard } from "@/features/blog/components/blog-ui";
import { listLatestPosts } from "@/features/blog/queries";
import { CATEGORY_IMAGES, getPublicStats } from "@/features/home/queries";
import { ProviderCard } from "@/features/providers/components/provider-card";
import { listFeaturedProviders } from "@/features/providers/public-queries";
import { formatNumber } from "@/lib/utils";
import heroImage from "../../../public/images/hero-home-repair.webp";

const STEPS = [
  { icon: ClipboardList, title: "ثبت درخواست", text: "خدمت و شهر را انتخاب کنید و جزئیات کار را با فرم مخصوص همان خدمت بنویسید." },
  { icon: Scale, title: "مقایسه پیشنهادها", text: "متخصصان تأییدشده قیمت و زمان پیشنهاد می‌دهند؛ امتیاز و سابقه‌شان را ببینید." },
  { icon: MessagesSquare, title: "گفتگو و انتخاب", text: "پیش از انتخاب با متخصص گفتگو کنید، عکس بفرستید و بهترین گزینه را برگزینید." },
  { icon: Star, title: "پرداخت امن و امتیاز", text: "مبلغ تا تأیید پایان کار نزد سروینو می‌ماند؛ سپس تجربه‌تان را ثبت کنید." },
];

const TRUST = [
  { icon: BadgeCheck, title: "متخصصان تأییدشده", text: "بررسی مدارک و سوابق پیش از فعال‌شدن" },
  { icon: HandCoins, title: "پرداخت امانی", text: "آزادسازی مبلغ فقط پس از تأیید شما" },
  { icon: ShieldCheck, title: "حریم خصوصی", text: "نشانی شما فقط برای متخصص منتخب" },
];

export default async function HomePage() {
  await connection(); // catalog and stats are read from the database at request time
  const [catalog, featured, stats, posts] = await Promise.all([
    getPublicCatalog(),
    listFeaturedProviders("HOME", 6),
    getPublicStats(),
    listLatestPosts(3),
  ]);
  const popular = catalog.flatMap((c) => servicesOfCategory(c)).slice(0, 5);

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-secondary/70 via-background to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="size-4" aria-hidden />
              متخصصان تأییدشده · پرداخت امانی
            </span>
            <h1 className="text-3xl leading-[1.5] font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl lg:leading-[1.4]">
              کارهای خانه را به <span className="text-primary">متخصص مطمئن</span> بسپارید
            </h1>
            <p className="max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              درخواستتان را در چند دقیقه ثبت کنید، از متخصصان تأییدشده شهرتان پیشنهاد قیمت بگیرید، گفتگو کنید و با خیال راحت
              انتخاب کنید.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/services">
                  ثبت درخواست خدمت
                  <ArrowLeft />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link href="/register?role=provider">
                  <Wrench />
                  به‌عنوان متخصص بپیوندید
                </Link>
              </Button>
            </div>
            {popular.length ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">پرطرفدار:</span>
                {popular.map((s) => (
                  <Link
                    key={s.id}
                    href={`/request/${s.slug}`}
                    className="rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Image
              src={heroImage}
              alt="متخصص فنی در حال تعمیر و نگهداری تجهیزات منزل"
              priority
              placeholder="blur"
              sizes="(min-width: 1024px) 540px, 100vw"
              className="aspect-[16/11] w-full rounded-[2rem] object-cover shadow-lifted"
            />
            <div className="absolute -bottom-5 start-4 flex items-center gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-lifted backdrop-blur sm:start-6">
              <span className="grid size-10 place-items-center rounded-xl bg-highlight/20 text-amber-700 dark:text-amber-300">
                <Star className="size-5 fill-current" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold">
                  {stats.avgRating ? `${stats.avgRating.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} از ۵` : "امتیازدهی شفاف"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.reviewCount ? `میانگین ${formatNumber(stats.reviewCount)} نظر ثبت‌شده` : "نظر مشتریان واقعی پس از هر سفارش"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-10">
          <dl className="grid auto-cols-fr grid-flow-col divide-x divide-x-reverse rounded-2xl border bg-card shadow-soft">
            {[
              { label: "متخصص تأییدشده", value: stats.providers },
              { label: "خدمت فعال", value: stats.services },
              { label: "سفارش انجام‌شده", value: stats.completedOrders },
            ]
              .filter((s) => s.value > 0)
              .map((s) => (
              <div key={s.label} className="px-3 py-4 text-center sm:py-5">
                <dt className="text-xs text-muted-foreground sm:text-sm">{s.label}</dt>
                <dd className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">{formatNumber(s.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-14">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">دسته‌بندی خدمات</h2>
            <p className="text-sm text-muted-foreground">خدمت مورد نیاز خود را از میان دسته‌بندی‌ها پیدا کنید.</p>
          </div>
          <Button asChild variant="link" className="shrink-0">
            <Link href="/services">
              همه خدمات
              <ArrowLeft />
            </Link>
          </Button>
        </div>

        {catalog.length === 0 ? (
          <EmptyState title="هنوز دسته‌بندی‌ای ثبت نشده است" description="به‌زودی خدمات به این بخش اضافه می‌شوند." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.map((category) => {
              const services = servicesOfCategory(category);
              const img = CATEGORY_IMAGES[category.slug];
              return (
                <Link
                  key={category.id}
                  href={`/services#${category.slug}`}
                  className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lifted"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                    {img ? (
                      <Image
                        src={img.src}
                        alt={img.alt}
                        fill
                        sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-primary">
                        <ServiceIcon name={category.icon} className="size-10" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <h3 className="flex items-center gap-2 font-semibold group-hover:text-primary">
                      <ServiceIcon name={category.icon} className="size-4 text-primary" />
                      {category.name}
                    </h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(services.length)} خدمت</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-14">
          <div className="max-w-2xl space-y-1">
            <h2 className="text-2xl font-bold">سروینو چطور کار می‌کند؟</h2>
            <p className="text-sm text-muted-foreground">از ثبت درخواست تا پایان کار، همه مراحل شفاف و قابل پیگیری است.</p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
                <span className="absolute top-4 end-4 text-3xl font-extrabold text-primary/10" aria-hidden>
                  {(i + 1).toLocaleString("fa-IR")}
                </span>
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <ul className="grid gap-3 sm:grid-cols-3">
            {TRUST.map((t) => (
              <li key={t.title} className="flex items-center gap-3 rounded-xl bg-card/70 px-4 py-3">
                <t.icon className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="text-sm">
                  <strong className="font-semibold">{t.title}</strong>
                  <span className="text-muted-foreground"> — {t.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Featured providers ─────────────────────────────────────────── */}
      {featured.length > 0 ? (
        <section className="mx-auto max-w-6xl space-y-6 px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Sparkles className="size-5 text-amber-500" aria-hidden />
                متخصصان ویژه
              </h2>
              <p className="text-sm text-muted-foreground">متخصصان تأییدشده و برگزیده سروینو</p>
            </div>
            <Button asChild variant="link" className="shrink-0">
              <Link href="/providers">
                همه متخصصان
                <ArrowLeft />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <ProviderCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Latest blog posts ──────────────────────────────────────────── */}
      {posts.length > 0 ? (
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-14">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">تازه‌های مجله</h2>
                <p className="text-sm text-muted-foreground">راهنماهای کاربردی نگهداری خانه از متخصصان سروینو</p>
              </div>
              <Button asChild variant="link" className="shrink-0">
                <Link href="/blog">
                  همه مقاله‌ها
                  <ArrowLeft />
                </Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <BlogPostCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Provider CTA ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-10 text-primary-foreground sm:px-12 sm:py-14">
          <div className="pointer-events-none absolute -top-16 -start-16 size-56 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl font-bold sm:text-3xl">متخصص هستید؟ مشتریان تازه پیدا کنید</h2>
              <p className="leading-8 text-primary-foreground/85">
                پروفایل حرفه‌ای بسازید، درخواست‌های مرتبط شهرتان را دریافت کنید و درآمدتان را از داشبورد پیگیری کنید.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
              <Link href="/register?role=provider">
                ثبت‌نام متخصصان
                <ArrowLeft />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
