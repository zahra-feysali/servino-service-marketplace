import type { Metadata } from "next";
import { Archive, Inbox, Mail, MailOpen, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { setContactStatusAction } from "@/features/contact/actions";
import { CONTACT_STATUS_META } from "@/features/contact/schemas";
import { adminListContactMessages } from "@/features/contact/service";
import { requireRolePage } from "@/lib/authz";
import { parsePage } from "@/lib/pagination";
import { formatDateTime, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "پیام‌های تماس با ما" };
const STATUSES = ["NEW", "READ", "ARCHIVED"] as const;
const BASE = "/dashboard/admin/contact";

export default async function AdminContactPage({ searchParams }: PageProps<"/dashboard/admin/contact">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const status = pickParam(sp.status, STATUSES);
  const list = await adminListContactMessages(status, parsePage(sp.page));

  return (
    <>
      <PageHeader icon={Inbox} title="پیام‌های تماس با ما" description="پیام‌های ارسال‌شده از فرم «تماس با ما» سایت" />
      <FilterLinks
        basePath={BASE}
        param="status"
        current={status}
        options={[{ value: "", label: "فعال (جدید و خوانده‌شده)" }, ...STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS_META[s].label }))]}
      />
      {list.items.length === 0 ? (
        <EmptyState icon={Inbox} title="پیامی وجود ندارد" />
      ) : (
        <div className="space-y-4">
          {list.items.map((m) => (
            <Card key={m.id} className={m.status === "NEW" ? "border-primary/40" : undefined}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {m.subject}
                      <Badge variant={CONTACT_STATUS_META[m.status].variant}>{CONTACT_STATUS_META[m.status].label}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{toPersianDigits(m.code)} · {m.name} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {m.status !== "READ" ? (
                      <ActionButton action={setContactStatusAction.bind(null, m.id, "READ")} size="sm" variant="outline">
                        <MailOpen />
                        خوانده شد
                      </ActionButton>
                    ) : (
                      <ActionButton action={setContactStatusAction.bind(null, m.id, "NEW")} size="sm" variant="outline">
                        <Mail />
                        علامت جدید
                      </ActionButton>
                    )}
                    {m.status !== "ARCHIVED" ? (
                      <ActionButton action={setContactStatusAction.bind(null, m.id, "ARCHIVED")} size="sm" variant="ghost">
                        <Archive />
                        بایگانی
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm leading-7 whitespace-pre-line">{m.message}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {m.phone ? (
                    <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-primary hover:underline" dir="ltr">
                      <Phone className="size-4" aria-hidden />
                      {m.phone}
                    </a>
                  ) : null}
                  {m.email ? (
                    <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-primary hover:underline" dir="ltr">
                      <Mail className="size-4" aria-hidden />
                      {m.email}
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PaginationNav basePath={BASE} params={sp} page={list.page} totalPages={list.totalPages} total={list.total} />
    </>
  );
}
