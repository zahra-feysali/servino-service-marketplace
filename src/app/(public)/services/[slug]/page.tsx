import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeft, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceIcon } from "@/components/shared/service-icon";
import { getPublicServiceBySlug } from "@/features/catalog/queries";
import { formatNumber } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublicServiceBySlug(decodeURIComponent(slug)).catch(() => null);
  return { title: service?.name ?? "خدمت" };
}

export default async function ServiceDetailPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const service = await getPublicServiceBySlug(decodeURIComponent(slug));
  if (!service) notFound();

  const parent = service.category.parent;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="مسیر">
        <Link href="/services" className="hover:text-foreground">
          خدمات
        </Link>
        <ChevronLeft className="size-4" aria-hidden />
        <Link href={`/services#${(parent ?? service.category).slug}`} className="hover:text-foreground">
          {(parent ?? service.category).name}
        </Link>
        {parent ? (
          <>
            <ChevronLeft className="size-4" aria-hidden />
            <span>{service.category.name}</span>
          </>
        ) : null}
      </nav>

      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <ServiceIcon name={service.icon} className="size-7" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{service.name}</h1>
          {service.shortDescription ? <p className="text-muted-foreground">{service.shortDescription}</p> : null}
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            {formatNumber(service._count.providerServices)} متخصص تأییدشده این خدمت را ارائه می‌دهند
          </p>
        </div>
      </div>

      {service.description ? (
        <Card>
          <CardHeader>
            <CardTitle>درباره این خدمت</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-8 whitespace-pre-line text-muted-foreground">{service.description}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/30 bg-secondary/40">
        <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="font-semibold">درخواست خود را ثبت کنید</h2>
            <p className="text-sm text-muted-foreground">
              فرم کوتاه را پر کنید تا متخصصان تأییدشده شهر شما پیشنهاد قیمت ارسال کنند.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href={`/request/${service.slug}`}>
              <Send />
              ثبت درخواست
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
