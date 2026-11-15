"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction } from "@/features/marketplace/actions";
import { cn, toPersianDigits } from "@/lib/utils";

export function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (rating < 1) {
      setError("امتیاز را انتخاب کنید.");
      return;
    }
    startTransition(async () => {
      const result = await submitReviewAction(orderId, { rating, comment: comment.trim() || undefined });
      if (!result.ok) {
        toast.error(result.error);
        setError(result.fieldErrors?.comment?.[0] ?? result.fieldErrors?.rating?.[0] ?? null);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">ثبت امتیاز و نظر</h3>
      <div className="flex gap-1" role="radiogroup" aria-label="امتیاز">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${toPersianDigits(n)} ستاره`}
            onClick={() => {
              setRating(n);
              setError(null);
            }}
            className="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Star className={cn("size-7", n <= rating ? "fill-warning text-warning" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      <Field>
        <FieldLabel htmlFor="review-comment">نظر شما (اختیاری)</FieldLabel>
        <Textarea id="review-comment" rows={3} maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <FieldError>{error}</FieldError>
      <Button onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        ثبت نظر
      </Button>
    </div>
  );
}
