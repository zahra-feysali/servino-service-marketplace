import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, BadgeCheck, ClipboardList, Scale, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ServiceIcon } from "@/components/shared/service-icon";
import { getPublicCatalog, servicesOfCategory } from "@/features/catalog/queries";
import { ProviderCard } from "@/features/providers/components/provider-card";
import { listFeaturedProviders } from "@/features/providers/public-queries";
import { formatNumber } from "@/lib/utils";

const STEPS = [
  { icon: ClipboardList, title: "ثبت درخواست", text: "خدمت مورد نیاز و شهر خود را انتخاب کنید و جزئیات را بنویسید." },
  { icon: Scale, title: "مقایسه پیشنهادها", text: "متخصصان تأییدشده قیمت و زمان انجام کار را پیشنهاد می‌دهند." },
  { icon: BadgeCheck, title: "انتخاب متخصص", text: "بهترین پیشنهاد را انتخاب کنید و روند سفارش را پیگیری کنید." },
  { icon: Star, title: "ثبت امتیاز", text: "پس از اتمام کار، تجربه خود را با دیگران به اشتراک بگذارید." },
];

export default async function HomePage() {
  await connection(); // catalog is read from the database at request time
  const [catalog, featured] = await Promise.all([getPublicCatalog(), listFeaturedProviders("HOME", 6)]);

  return (
    <>
      <section className="border-b bg-gradient-to-b from-secondary/60 to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <ShieldCheck className="size-4" aria-hidden />
              متخصصان تأییدشده توسط سروینو
            </span>
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              هر خدمتی که لازم دارید،
              <br />
              <span className="text-primary">از بهترین متخصصان</span>
            </h1>
            <p className="max-w-lg text-base leading-8 text-muted-foreground">
              درخواست خود را ثبت کنید، از متخصصان نزدیک خود پیشنهاد قیمت بگیرید و با خیال راحت بهترین گزینه را انتخاب
              کنید.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/services">
                  مشاهده خدمات
                  <ArrowLeft />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register?role=provider">متخصص هستید؟ ثبت‌نام کنید</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {STEPS.map((step) => (
              <Card key={step.title} className="shadow-sm">
                <CardContent className="space-y-2">
                  <step.icon className="size-6 text-primary" aria-hidden />
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((category) => {
              const services = servicesOfCategory(category);
              return (
                <Link key={category.id} href={`/services#${category.slug}`} className="group">
                  <Card className="h-full transition-shadow group-hover:shadow-md">
                    <CardContent className="flex items-start gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                        <ServiceIcon name={category.icon} className="size-6" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <h3 className="font-semibold group-hover:text-primary">{category.name}</h3>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(services.length)} خدمت</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {featured.length > 0 ? (
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-14">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">متخصصان ویژه</h2>
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
          </div>
        </section>
      ) : null}
    </>
  );
}
