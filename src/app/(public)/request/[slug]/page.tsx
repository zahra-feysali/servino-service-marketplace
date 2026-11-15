import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/shared/service-icon";
import { getCurrentUserSafe } from "@/features/auth/current-user-safe";
import { dashboardPathForRole } from "@/features/auth/rbac";
import { RequestForm } from "@/features/requests/components/request-form";
import { getActiveCitiesGrouped } from "@/features/requests/queries";
import { getActiveServiceForm } from "@/features/requests/service";

export const metadata: Metadata = { title: "ثبت درخواست" };

export default async function RequestPage({ params }: PageProps<"/request/[slug]">) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const user = await getCurrentUserSafe();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/request/${decoded}`)}`);

  const service = await getActiveServiceForm({ slug: decoded });
  if (!service) notFound();

  if (user.role !== "CUSTOMER") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert>
          <Info />
          <AlertTitle>ثبت درخواست فقط برای مشتریان</AlertTitle>
          <AlertDescription>
            <p>برای ثبت درخواست خدمت باید با حساب مشتری وارد شوید.</p>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link href={dashboardPathForRole(user.role)}>بازگشت به داشبورد</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const provinces = await getActiveCitiesGrouped();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="مسیر">
        <Link href={`/services/${service.slug}`} className="hover:text-foreground">
          {service.name}
        </Link>
        <ChevronLeft className="size-4" aria-hidden />
        <span>ثبت درخواست</span>
      </nav>
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <ServiceIcon name={service.icon} className="size-6" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">ثبت درخواست {service.name}</h1>
          <p className="text-sm text-muted-foreground">
            پس از ثبت، درخواست برای متخصصان تأییدشده در شهر شما ارسال می‌شود و پیشنهادهای قیمت را در داشبورد خود
            می‌بینید.
          </p>
        </div>
      </div>
      <RequestForm serviceId={service.id} fields={service.fields} provinces={provinces} />
    </div>
  );
}
