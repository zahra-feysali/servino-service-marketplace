"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestWithdrawalAction } from "@/features/withdrawals/actions";
import { formatPrice, toEnglishDigits } from "@/lib/utils";

type Props = {
  available: number;
  minWithdrawal: number;
  destination: { holderName: string; maskedIban: string; bankName: string | null };
};

const newKey = () => crypto.randomUUID();

/** Parses the typed amount for the preview only; the server validates it again. */
function parseAmount(raw: string): number | null {
  const cleaned = toEnglishDigits(raw).replace(/[,\s٬،]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Withdrawal request: amount → review dialog (amount + destination account) → submit.
 * A per-form idempotency key makes a double submission return the same request on the server.
 */
export function WithdrawalRequestForm({ available, minWithdrawal, destination }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [clientKey, setClientKey] = useState(newKey);
  const [pending, startTransition] = useTransition();
  const parsed = parseAmount(amount);

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (parsed === null || parsed <= 0) return setError("مبلغ را به عدد صحیح و به تومان وارد کنید.");
    if (minWithdrawal > 0 && parsed < minWithdrawal) return setError(`حداقل مبلغ برداشت ${formatPrice(minWithdrawal)} است.`);
    if (parsed > available) return setError(`مبلغ از موجودی قابل برداشت (${formatPrice(available)}) بیشتر است.`);
    setError(null);
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("amount", amount);
      fd.set("clientKey", clientKey);
      let r;
      try {
        r = await requestWithdrawalAction(fd);
      } catch {
        toast.error("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
        return;
      }
      if (!r.ok) {
        setError(r.fieldErrors?.amount?.[0] ?? r.error);
        toast.error(r.error);
        setOpen(false);
        return;
      }
      toast.success(r.message ?? "درخواست ثبت شد.");
      setOpen(false);
      setAmount("");
      setClientKey(newKey());
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={review} className="flex flex-col gap-3" noValidate>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="withdraw-amount">مبلغ برداشت (تومان)</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="withdraw-amount"
              name="amount"
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              placeholder="1000000"
              value={amount}
              aria-invalid={!!error}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
            <Button type="button" variant="outline" onClick={() => setAmount(String(available))} disabled={available <= 0}>
              کل موجودی
            </Button>
          </div>
          <FieldDescription>
            قابل برداشت: {formatPrice(available)}
            {minWithdrawal > 0 ? ` — حداقل ${formatPrice(minWithdrawal)}` : ""}
            {parsed && parsed > 0 ? ` — مبلغ واردشده: ${formatPrice(parsed)}` : ""}
          </FieldDescription>
          <FieldError>{error}</FieldError>
        </Field>
        <Button type="submit" className="self-start" disabled={available <= 0 || pending}>
          بررسی و ثبت درخواست
        </Button>
      </form>

      <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأیید درخواست برداشت</AlertDialogTitle>
            <AlertDialogDescription>
              این مبلغ از موجودی قابل برداشت شما رزرو می‌شود. واریز به حساب بانکی به‌صورت دستی توسط مدیریت انجام می‌شود و سایت پولی را به‌طور خودکار منتقل نمی‌کند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
            <dt className="text-muted-foreground">مبلغ</dt>
            <dd className="font-bold">{parsed ? formatPrice(parsed) : "—"}</dd>
            <dt className="text-muted-foreground">صاحب حساب</dt>
            <dd>{destination.holderName}</dd>
            <dt className="text-muted-foreground">شبا مقصد</dt>
            <dd dir="ltr" className="text-end font-mono">
              {destination.maskedIban}
            </dd>
            {destination.bankName ? (
              <>
                <dt className="text-muted-foreground">بانک</dt>
                <dd>{destination.bankName}</dd>
              </>
            ) : null}
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>انصراف</AlertDialogCancel>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Landmark />}
              ثبت درخواست برداشت
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
