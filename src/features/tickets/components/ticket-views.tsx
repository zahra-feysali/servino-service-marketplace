import Link from "next/link";
import { LifeBuoy, Lock, LockOpen, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { ROLE_LABELS, type AppRole } from "@/features/auth/rbac";
import { createTicketAction, replyTicketAction, setTicketClosedAction } from "@/features/tickets/actions";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, TICKET_STATUS_META } from "@/features/tickets/rules";
import type { adminGetTicket, listUserTickets } from "@/features/tickets/service";
import { cn, formatDateTime, toPersianDigits } from "@/lib/utils";

type Tickets = Awaited<ReturnType<typeof listUserTickets>>;
type Ticket = NonNullable<Awaited<ReturnType<typeof adminGetTicket>>>;

export function TicketList({
  tickets,
  basePath,
  showNew = true,
  showUser = false,
  filters,
}: {
  tickets: (Tickets[number] & { user?: { fullName: string; role: AppRole } })[];
  basePath: string;
  showNew?: boolean;
  showUser?: boolean;
  filters?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="تیکت‌های پشتیبانی"
        description="ارتباط با تیم پشتیبانی سروینو"
        actions={
          showNew ? (
            <Button asChild>
              <Link href={`${basePath}/new`}>
                <Plus />
                تیکت جدید
              </Link>
            </Button>
          ) : null
        }
      />
      {filters}
      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="تیکتی وجود ندارد" />
      ) : (
        <div className="rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">شماره</TableHead>
                <TableHead className="text-start">عنوان</TableHead>
                {showUser ? <TableHead className="text-start">کاربر</TableHead> : null}
                <TableHead className="text-start">دسته</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">آخرین به‌روزرسانی</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{toPersianDigits(t.code)}</TableCell>
                  <TableCell className="max-w-64 truncate font-medium">{t.subject}</TableCell>
                  {showUser ? (
                    <TableCell>
                      {t.user?.fullName}
                      <span className="block text-xs text-muted-foreground">{t.user ? ROLE_LABELS[t.user.role] : ""}</span>
                    </TableCell>
                  ) : null}
                  <TableCell>{TICKET_CATEGORY_LABELS[t.category]}</TableCell>
                  <TableCell>
                    <Badge variant={TICKET_STATUS_META[t.status].variant}>{TICKET_STATUS_META[t.status].label}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(t.updatedAt)}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`${basePath}/${t.id}`}>مشاهده</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

export function NewTicketForm({ orders }: { orders: { id: string; code: number; service: { name: string } }[] }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">تیکت جدید</CardTitle>
        <CardDescription>مشکل یا سؤال خود را با جزئیات بنویسید.</CardDescription>
      </CardHeader>
      <CardContent>
        <ServerForm action={createTicketAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="subject">عنوان</FieldLabel>
              <Input id="subject" name="subject" required maxLength={200} />
              <FormFieldError name="subject" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="category">دسته</FieldLabel>
                <NativeSelect id="category" name="category" className="w-full" defaultValue="GENERAL">
                  {TICKET_CATEGORIES.map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {TICKET_CATEGORY_LABELS[c]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="orderId">سفارش مرتبط (اختیاری)</FieldLabel>
                <NativeSelect id="orderId" name="orderId" className="w-full" defaultValue="">
                  <NativeSelectOption value="">—</NativeSelectOption>
                  {orders.map((o) => (
                    <NativeSelectOption key={o.id} value={o.id}>
                      {`سفارش ${toPersianDigits(o.code)} — ${o.service.name}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FormFieldError name="orderId" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="message">متن پیام</FieldLabel>
              <Textarea id="message" name="message" rows={6} required maxLength={5000} />
              <FormFieldError name="message" />
            </Field>
            <SubmitButton className="justify-self-start">ثبت تیکت</SubmitButton>
          </FieldGroup>
        </ServerForm>
      </CardContent>
    </Card>
  );
}

/** Ticket conversation. `viewerIsStaff` controls reply wording and staff-only controls. */
export function TicketThread({ ticket, viewerIsStaff, orderHref }: { ticket: Ticket; viewerIsStaff: boolean; orderHref?: string }) {
  const meta = TICKET_STATUS_META[ticket.status];
  const closed = ticket.status === "CLOSED";
  return (
    <>
      <PageHeader
        title={`تیکت ${toPersianDigits(ticket.code)} — ${ticket.subject}`}
        description={`${TICKET_CATEGORY_LABELS[ticket.category]} · ${formatDateTime(ticket.createdAt)}${viewerIsStaff ? ` · ${ticket.user.fullName} (${ROLE_LABELS[ticket.user.role]}، ${ticket.user.phone})` : ""}`}
        actions={
          <>
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {ticket.order && orderHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={orderHref}>سفارش {toPersianDigits(ticket.order.code)}</Link>
              </Button>
            ) : null}
            <ActionButton action={setTicketClosedAction.bind(null, ticket.id, !closed)} size="sm" variant="outline">
              {closed ? <LockOpen /> : <Lock />}
              {closed ? "بازگشایی" : "بستن تیکت"}
            </ActionButton>
          </>
        }
      />
      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={cn("max-w-3xl rounded-xl border p-4", m.isStaff ? "me-auto border-primary/30 bg-secondary/50" : "ms-auto bg-card")}
          >
            <p className="mb-1 text-xs text-muted-foreground">
              {m.isStaff ? "پشتیبانی سروینو" : m.author.fullName} · {formatDateTime(m.createdAt)}
            </p>
            <p className="text-sm leading-7 whitespace-pre-line">{m.body}</p>
          </div>
        ))}
      </div>
      {closed && viewerIsStaff ? (
        <p className="text-sm text-muted-foreground">این تیکت بسته است. برای پاسخ ابتدا آن را بازگشایی کنید.</p>
      ) : (
        <Card className="max-w-3xl">
          <CardContent>
            <ServerForm action={replyTicketAction.bind(null, ticket.id)} resetOnSuccess>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reply">{viewerIsStaff ? "پاسخ پشتیبانی" : closed ? "ارسال پیام (تیکت دوباره باز می‌شود)" : "پاسخ شما"}</FieldLabel>
                  <Textarea id="reply" name="message" rows={4} required maxLength={5000} />
                  <FormFieldError name="message" />
                </Field>
                <SubmitButton className="justify-self-start">ارسال</SubmitButton>
              </FieldGroup>
            </ServerForm>
          </CardContent>
        </Card>
      )}
    </>
  );
}
