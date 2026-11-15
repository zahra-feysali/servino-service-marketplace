import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, ShieldOff, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { adminReviewProviderAction, adminRevokeProviderAction, adminSetDocumentStatusAction } from "@/features/admin/actions";
import { VERIFICATION_STATUS_META } from "@/features/providers/labels";
import { DOCUMENT_STATUS_META, DOCUMENT_TYPE_LABELS } from "@/features/providers/verification";
import { adminGetProviderForReview } from "@/features/users/admin-service";
import { USER_STATUS_LABELS } from "@/features/users/labels";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatDateTime, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "بررسی متخصص" };

export default async function AdminProviderPage({ params }: PageProps<"/dashboard/admin/providers/[id]">) {
  await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const p = await adminGetProviderForReview(id);
  if (!p) notFound();
  const meta = VERIFICATION_STATUS_META[p.verificationStatus];

  return (
    <>
      <PageHeader
        title={p.displayName}
        description={`${p.user.fullName} · ${p.user.phone} · حساب ${USER_STATUS_LABELS[p.user.status]}`}
        actions={
          <>
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/admin/users/${p.user.id}`}>مدیریت حساب</Link>
            </Button>
            {p.verificationStatus === "APPROVED" ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/providers/${p.id}`} target="_blank">
                  <ExternalLink />
                  صفحه عمومی
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تصمیم مدیر</CardTitle>
          <CardDescription>
            {p.submittedAt ? `ارسال برای بررسی: ${formatDateTime(p.submittedAt)}` : "هنوز برای بررسی ارسال نشده است."}
            {p.reviewedAt ? ` · آخرین بررسی: ${formatDateTime(p.reviewedAt)}${p.reviewedBy ? ` توسط ${p.reviewedBy.fullName}` : ""}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {p.rejectionReason ? <p className="w-full text-sm text-destructive">دلیل رد قبلی: {p.rejectionReason}</p> : null}
          {p.verificationStatus === "PENDING" ? (
            <>
              <ActionButton
                action={adminReviewProviderAction.bind(null, p.id, "APPROVE")}
                confirm={{ title: "تأیید متخصص؟", description: "مدارک در انتظار نیز تأیید می‌شوند.", confirmLabel: "تأیید" }}
              >
                <CheckCircle2 />
                تأیید پروفایل
              </ActionButton>
              <ActionButton
                action={adminReviewProviderAction.bind(null, p.id, "REJECT")}
                variant="destructive"
                confirm={{ title: "رد پروفایل؟", confirmLabel: "رد", destructive: true }}
                note={{ label: "دلیل رد (برای متخصص ارسال می‌شود)", required: true }}
              >
                <XCircle />
                رد پروفایل
              </ActionButton>
            </>
          ) : p.verificationStatus === "APPROVED" ? (
            <ActionButton
              action={adminRevokeProviderAction.bind(null, p.id)}
              variant="outline"
              confirm={{ title: "لغو تأیید متخصص؟", description: "متخصص دیگر درخواست جدید دریافت نمی‌کند.", confirmLabel: "لغو تأیید", destructive: true }}
              note={{ label: "دلیل", required: true }}
            >
              <ShieldOff />
              لغو تأیید
            </ActionButton>
          ) : (
            <p className="text-sm text-muted-foreground">پس از ارسال پروفایل توسط متخصص، امکان تأیید یا رد فراهم می‌شود.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">اطلاعات حرفه‌ای</CardTitle>
            <CardDescription>
              سابقه {toPersianDigits(p.yearsOfExperience)} سال · {toPersianDigits(p.completedOrdersCount)} سفارش موفق · امتیاز{" "}
              {p.ratingCount ? p.ratingAverage.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="leading-7 whitespace-pre-line">{p.bio || "—"}</p>
            <p><span className="text-muted-foreground">خدمات: </span>{p.services.map((s) => s.service.name).join("، ") || "—"}</p>
            <p><span className="text-muted-foreground">شهرها: </span>{p.areas.map((a) => a.city.name).join("، ") || "—"}</p>
            <p><span className="text-muted-foreground">مهارت‌ها: </span>{p.skills.map((s) => s.name).join("، ") || "—"}</p>
            <p><span className="text-muted-foreground">نمونه‌کارها: </span>{toPersianDigits(p.portfolio.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">مدارک</CardTitle>
          </CardHeader>
          <CardContent>
            {p.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">مدرکی بارگذاری نشده است.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">مدرک</TableHead>
                    <TableHead className="text-start">وضعیت</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <a href={`/api/provider-files/document/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                          {d.title}
                        </a>
                        <span className="block text-xs text-muted-foreground">
                          {DOCUMENT_TYPE_LABELS[d.type]} · {formatDate(d.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={DOCUMENT_STATUS_META[d.status].variant}>{DOCUMENT_STATUS_META[d.status].label}</Badge>
                      </TableCell>
                      <TableCell className="flex gap-1">
                        {d.status !== "APPROVED" ? (
                          <ActionButton action={adminSetDocumentStatusAction.bind(null, d.id, "APPROVED")} size="sm" variant="outline">
                            تأیید
                          </ActionButton>
                        ) : null}
                        {d.status !== "REJECTED" ? (
                          <ActionButton
                            action={adminSetDocumentStatusAction.bind(null, d.id, "REJECTED")}
                            size="sm"
                            variant="ghost"
                            note={{ label: "توضیح برای متخصص" }}
                            confirm={{ title: "رد مدرک؟", confirmLabel: "رد", destructive: true }}
                          >
                            رد
                          </ActionButton>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
