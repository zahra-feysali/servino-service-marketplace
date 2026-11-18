import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { CurrentUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { NotFoundError } from "@/lib/errors";
import { getConversationForUser, readMessages } from "@/features/chat/service";
import { toPersianDigits } from "@/lib/utils";
import { ChatThread } from "./chat-thread";

/** Conversation page body shared by the customer and provider dashboards. */
export async function ConversationPage({ user, id }: { user: CurrentUser; id: string }) {
  if (!isUuid(id) || user.role === "ADMIN") notFound();
  let data: Awaited<ReturnType<typeof getConversationForUser>>;
  let initial: Awaited<ReturnType<typeof readMessages>>;
  try {
    data = await getConversationForUser(user, id);
    initial = await readMessages(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { conv, side, state, order, counterpart } = data;
  const base = side === "CUSTOMER" ? "/dashboard/customer" : "/dashboard/provider";
  const requestHref = `${base}/requests/${conv.requestId}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="بازگشت به پیام‌ها">
            <Link href={`${base}/messages`}>
              <ArrowRight />
            </Link>
          </Button>
          <UserAvatar name={counterpart.name} src={counterpart.avatarUrl} size="md" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{counterpart.name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {conv.request.service.name} · درخواست {toPersianDigits(conv.request.code)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={requestHref}>
              <ClipboardList />
              درخواست
            </Link>
          </Button>
          {order ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/orders/${order.id}`}>
                <PackageCheck />
                سفارش {toPersianDigits(order.code)}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <ChatThread
        conversationId={conv.id}
        meId={user.id}
        initialMessages={initial.messages}
        initialHasMore={initial.hasMore}
        initialCounterpartReadAt={initial.counterpartReadAt}
        counterpart={counterpart}
        canSend={state.canSend}
        closedReason={state.canSend ? undefined : state.reason}
      />
    </div>
  );
}
