import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BadgeCheck, Briefcase, ImageIcon, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicProvider } from "@/features/providers/public-queries";
import { ReviewList, Stars } from "@/features/reviews/components/review-list";
import { isUuid } from "@/lib/db-locks";
import { maskName, toPersianDigits } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { avatarSrc } from "@/features/avatars/rules";

type Props = PageProps<"/providers/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = isUuid(id) ? await getPublicProvider(id).catch(() => null) : null;
  return { title: p?.displayName ?? "متخصص" };
}

export default async function ProviderProfilePage({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const p = await getPublicProvider(id);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar name={p.displayName} src={avatarSrc(p.userId, p.user.avatarUpdatedAt)} size="xl" className="size-20 shrink-0 text-3xl" />
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {p.displayName}
            <BadgeCheck className="size-6 text-primary" aria-label="متخصص تأییدشده" />
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Stars rating={p.ratingAverage} />
            {p.ratingCount > 0 ? `${p.ratingAverage.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} از ${toPersianDigits(p.ratingCount)} نظر` : "هنوز نظری ثبت نشده"}
            <span>· {toPersianDigits(p.completedOrdersCount)} سفارش موفق</span>
            <span>· {toPersianDigits(p.yearsOfExperience)} سال سابقه</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">درباره متخصص</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="leading-8 whitespace-pre-line text-muted-foreground">{p.bio || "توضیحی ثبت نشده است."}</p>
            {p.skills.length ? (
              <div className="flex flex-wrap gap-1">
                {p.skills.map((s) => (
                  <Badge key={s.id} variant="secondary">
                    {s.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-semibold"><Briefcase className="size-4 text-primary" aria-hidden />خدمات</p>
              <div className="flex flex-wrap gap-1">
                {p.services.filter((s) => s.service.isActive).map((s) => (
                  <Link key={s.service.slug} href={`/services/${s.service.slug}`}>
                    <Badge variant="outline" className="hover:bg-muted">{s.service.name}</Badge>
                  </Link>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-primary" aria-hidden />مناطق خدمت‌رسانی</p>
              <p className="text-muted-foreground">{p.areas.map((a) => a.city.name).join("، ") || "—"}</p>
            </div>
            <p className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
              برای دریافت پیشنهاد از این متخصص، از صفحه خدمت مورد نظر درخواست ثبت کنید؛ درخواست برای متخصصان مرتبط شهر شما ارسال می‌شود.
            </p>
          </CardContent>
        </Card>
      </div>

      {p.portfolio.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">نمونه‌کارها</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.portfolio.map((item) => (
              <Card key={item.id} className="overflow-hidden pt-0">
                {item.imageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by an access-checked route handler
                  <img src={`/api/provider-files/portfolio/${item.id}`} alt={item.title} className="aspect-video w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="size-8" aria-hidden /></div>
                )}
                <CardContent className="space-y-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">نظرات مشتریان</h2>
        <ReviewList reviews={p.reviews.map((r) => ({ ...r, customer: { fullName: maskName(r.customer.fullName) } }))} />
      </section>
    </div>
  );
}
