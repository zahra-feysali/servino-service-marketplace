import Link from "next/link";
import { BellOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/features/notifications/actions";
import { listNotifications } from "@/features/notifications/service";
import { cn, formatDateTime } from "@/lib/utils";

/** Notifications page body shared by all roles; always scoped to the signed-in user. */
export async function NotificationList({ userId }: { userId: string }) {
  const items = await listNotifications(userId, { take: 100 });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="اعلان‌ها"
        description={unread > 0 ? `${unread.toLocaleString("fa-IR")} اعلان خوانده‌نشده` : "همه اعلان‌ها خوانده شده‌اند."}
        actions={
          unread > 0 ? (
            <ActionButton action={markAllNotificationsReadAction} variant="outline">
              <CheckCheck />
              علامت‌گذاری همه به‌عنوان خوانده‌شده
            </ActionButton>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title="اعلانی ندارید" />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((n) => (
            <li key={n.id} className={cn("flex flex-wrap items-start justify-between gap-3 p-4", !n.readAt && "bg-secondary/40")}>
              <div className="min-w-0 space-y-1">
                <p className={cn("text-sm", !n.readAt && "font-semibold")}>
                  {!n.readAt ? <span className="me-2 inline-block size-2 rounded-full bg-primary align-middle" aria-label="خوانده‌نشده" /> : null}
                  {n.title}
                </p>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {n.link ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={n.link}>مشاهده</Link>
                  </Button>
                ) : null}
                {!n.readAt ? (
                  <ActionButton action={markNotificationReadAction.bind(null, n.id)} size="sm" variant="ghost">
                    خوانده شد
                  </ActionButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
