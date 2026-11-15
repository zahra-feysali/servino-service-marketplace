import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Briefcase, Inbox, MapPin, Star, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { expireDueSubscriptions } from "@/features/subscriptions/service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getProviderOverview } from "@/features/dashboard/queries";
import { VERIFICATION_STATUS_META } from "@/features/providers/labels";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "پیشخوان متخصص" };

export default async function ProviderDashboardPage() {
  const user = await requireRolePage("PROVIDER");
  await expireDueSubscriptions();
  const overview = await getProviderOverview(user.id);

  if (!overview) {
    return (
      <EmptyState
        title="پروفایل متخصص یافت نشد"
        description="برای حساب شما پروفایل حرفه‌ای ایجاد نشده است. لطفاً با پشتیبانی تماس بگیرید."
      />
    );
  }

  const { profile, activeSubscription } = overview;
  const status = VERIFICATION_STATUS_META[profile.verificationStatus];

  return (
    <>
      <PageHeader
        title={profile.displayName}
        description="وضعیت حساب حرفه‌ای و فعالیت‌های شما"
        actions={<Badge variant={status.variant}>{status.label}</Badge>}
      />

      {profile.verificationStatus !== "APPROVED" ? (
        <Alert variant={profile.verificationStatus === "REJECTED" ? "destructive" : "default"}>
          <BadgeCheck />
          <AlertTitle>{status.label}</AlertTitle>
          <AlertDescription>
            <p>{status.description}</p>
            {profile.rejectionReason ? <p>دلیل: {profile.rejectionReason}</p> : null}
            {profile.verificationStatus !== "PENDING" ? (
              <Button asChild size="sm" className="mt-2">
                <Link href="/dashboard/provider/profile">تکمیل پروفایل و ارسال برای تأیید</Link>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="درخواست‌های دریافتی" value={overview.receivedRequests} icon={Inbox} />
        <StatCard label="سفارش‌های فعال" value={overview.activeOrders} icon={Briefcase} />
        <StatCard
          label="امتیاز"
          value={profile.ratingCount > 0 ? profile.ratingAverage.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) : "—"}
          icon={Star}
          hint={`${formatNumber(profile.ratingCount)} نظر`}
        />
        <StatCard label="موجودی کیف پول" value={formatPrice(overview.walletBalance)} icon={Wallet} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">اشتراک</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {activeSubscription ? (
              <p>
                اشتراک فعال: <strong className="text-foreground">{activeSubscription.plan.name}</strong>
                {activeSubscription.endsAt ? <> — تا {formatDate(activeSubscription.endsAt)}</> : null}
              </p>
            ) : (
              <p>اشتراک فعالی ندارید. بدون اشتراک فعال، درخواست جدیدی برای شما ارسال نمی‌شود.</p>
            )}
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/dashboard/provider/subscription">مدیریت اشتراک</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">خدمات و مناطق</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <span className="flex items-center gap-2">
              <Briefcase className="size-4 text-primary" aria-hidden />
              {formatNumber(profile._count.services)} خدمت
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" aria-hidden />
              {formatNumber(profile._count.areas)} شهر
            </span>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
