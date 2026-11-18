"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/features/chat/actions";

/** Opens (creating if needed) the chat about a request with a provider, then navigates to it. */
export function OpenChatButton({
  requestId,
  providerId,
  label = "گفتگو",
  variant = "outline",
  size = "sm",
}: {
  requestId: string;
  providerId?: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await startConversationAction(requestId, providerId);
          if (!r.ok) toast.error(r.error);
          else router.push(r.data.redirectTo);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <MessagesSquare />}
      {label}
    </Button>
  );
}
