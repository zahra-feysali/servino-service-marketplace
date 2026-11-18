import Link from "next/link";
import { MessagesSquare, Paperclip } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { listConversations } from "@/features/chat/service";
import { formatDate, formatTime, toPersianDigits } from "@/lib/utils";

type Item = Awaited<ReturnType<typeof listConversations>>[number];

function when(d: Date) {
  const today = formatDate(new Date());
  return formatDate(d) === today ? formatTime(d) : formatDate(d);
}

/** Inbox: one row per conversation with the counterpart, last message preview and unread badge. */
export function ConversationList({ items, emptyHint }: { items: Item[]; emptyHint: string }) {
  if (items.length === 0) return <EmptyState icon={MessagesSquare} title="هنوز گفتگویی ندارید" description={emptyHint} />;
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={c.path} className={cn("flex items-center gap-3 p-4 transition-colors hover:bg-muted/50", c.unread > 0 && "bg-primary/[0.04]")}>
            <UserAvatar name={c.counterpart.name} src={c.counterpart.avatarUrl} size="md" />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex items-center justify-between gap-2">
                <span className={cn("truncate", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.counterpart.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{when(c.lastMessage?.createdAt ?? c.lastMessageAt)}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.serviceName} · درخواست {toPersianDigits(c.requestCode)}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className={cn("flex min-w-0 items-center gap-1 truncate text-sm", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                  {c.lastMessage ? (
                    <>
                      {c.lastMessage.mine ? <span className="shrink-0 text-muted-foreground">شما:</span> : null}
                      {c.lastMessage.attachments > 0 ? <Paperclip className="size-3.5 shrink-0" aria-label="دارای فایل" /> : null}
                      <span className="truncate">{c.lastMessage.body ?? (c.lastMessage.attachments > 0 ? "فایل" : "")}</span>
                    </>
                  ) : (
                    "بدون پیام — گفتگو را شروع کنید"
                  )}
                </span>
                {c.unread > 0 ? (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[0.7rem] font-semibold text-primary-foreground">
                    {c.unread > 99 ? "۹۹+" : toPersianDigits(c.unread)}
                    <span className="sr-only"> پیام خوانده‌نشده</span>
                  </span>
                ) : null}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
