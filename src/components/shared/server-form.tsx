"use client";

import { createContext, useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";

type Result = ActionResult<unknown>;
const FormStateContext = createContext<{ result: Result | null; pending: boolean }>({ result: null, pending: false });

type Props = {
  /** Server Action taking FormData (usually pre-bound with ids), or… */
  action?: (formData: FormData) => Promise<Result>;
  /** …a Route Handler URL for multipart uploads (> 1 MB). */
  endpoint?: string;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
};

/**
 * Generic form for Server Actions / upload endpoints. Submits FormData without React's
 * automatic form reset (so values survive validation errors), shows a toast, exposes
 * field errors to <FormFieldError name="…" />, refreshes the page or follows
 * `data.redirectTo` returned by the server. All validation happens on the server.
 */
export function ServerForm({ action, endpoint, children, className, resetOnSuccess, onSuccess }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      let r: Result;
      try {
        if (action) r = await action(formData);
        else {
          const res = await fetch(endpoint!, { method: "POST", body: formData });
          r = (await res.json()) as Result;
        }
      } catch {
        r = { ok: false, error: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید." };
      }
      setResult(r);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.message) toast.success(r.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.();
      const redirectTo = (r.data as { redirectTo?: string } | undefined)?.redirectTo;
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <FormStateContext.Provider value={{ result, pending }}>
      <form ref={formRef} onSubmit={onSubmit} className={className} noValidate>
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </form>
    </FormStateContext.Provider>
  );
}

export function FormFieldError({ name }: { name: string }) {
  const { result } = useContext(FormStateContext);
  const message = result && !result.ok ? result.fieldErrors?.[name]?.[0] : undefined;
  return <FieldError>{message}</FieldError>;
}

export function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useContext(FormStateContext);
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
