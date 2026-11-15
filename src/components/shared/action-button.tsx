"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";

type Props = {
  /** A server action (usually pre-bound with `.bind(null, …ids)` in a Server Component). */
  action: (note?: string) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  confirm?: { title: string; description?: string; confirmLabel?: string; destructive?: boolean };
  note?: { label: string; required?: boolean; placeholder?: string };
  /** When the action returns `{ orderId }`, navigate to `${redirectBase}/${orderId}`. */
  redirectBase?: string;
};

export function ActionButton({ action, children, variant, size, className, confirm, note, redirectBase }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  function run() {
    if (note?.required && !noteValue.trim()) {
      setNoteError("نوشتن توضیح الزامی است.");
      return;
    }
    startTransition(async () => {
      const result = await action(note ? noteValue.trim() : undefined);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "انجام شد.");
      setOpen(false);
      setNoteValue("");
      const data = result.data as { orderId?: string } | undefined;
      if (redirectBase && data?.orderId) router.push(`${redirectBase}/${data.orderId}`);
      else router.refresh();
    });
  }

  const needsDialog = !!confirm || !!note;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() => (needsDialog ? setOpen(true) : run())}
      >
        {pending && !needsDialog ? <Loader2 className="animate-spin" /> : null}
        {children}
      </Button>

      {needsDialog ? (
        <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm?.title ?? "تأیید عملیات"}</AlertDialogTitle>
              {confirm?.description ? <AlertDialogDescription>{confirm.description}</AlertDialogDescription> : null}
            </AlertDialogHeader>
            {note ? (
              <Field data-invalid={!!noteError}>
                <FieldLabel htmlFor="action-note">
                  {note.label}
                  {note.required ? " *" : ""}
                </FieldLabel>
                <Textarea
                  id="action-note"
                  value={noteValue}
                  placeholder={note.placeholder}
                  maxLength={1000}
                  onChange={(e) => {
                    setNoteValue(e.target.value);
                    setNoteError(null);
                  }}
                />
                <FieldError>{noteError}</FieldError>
              </Field>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>انصراف</AlertDialogCancel>
              <Button variant={confirm?.destructive ? "destructive" : "default"} disabled={pending} onClick={run}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {confirm?.confirmLabel ?? "تأیید"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
