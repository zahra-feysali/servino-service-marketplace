import { Send } from "lucide-react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { submitContactAction } from "@/features/contact/actions";

/** Public contact form (validated on the server; rate limited per IP; hidden honeypot field). */
export function ContactForm() {
  return (
    <ServerForm action={submitContactAction} resetOnSuccess>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="c-name">
              نام و نام خانوادگی <span className="text-destructive">*</span>
            </FieldLabel>
            <Input id="c-name" name="name" required maxLength={120} autoComplete="name" />
            <FormFieldError name="name" />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-subject">
              موضوع <span className="text-destructive">*</span>
            </FieldLabel>
            <Input id="c-subject" name="subject" required maxLength={150} />
            <FormFieldError name="subject" />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-phone">شماره موبایل</FieldLabel>
            <Input id="c-phone" name="phone" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09121234567" className="text-end" />
            <FormFieldError name="phone" />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-email">ایمیل</FieldLabel>
            <Input id="c-email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="name@example.com" className="text-end" />
            <FormFieldError name="email" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="c-message">
            متن پیام <span className="text-destructive">*</span>
          </FieldLabel>
          <Textarea id="c-message" name="message" rows={6} required maxLength={3000} />
          <FormFieldError name="message" />
        </Field>
        <div aria-hidden className="hidden">
          <label htmlFor="c-website">وب‌سایت</label>
          <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <SubmitButton className="justify-self-start">
          <Send />
          ارسال پیام
        </SubmitButton>
      </FieldGroup>
    </ServerForm>
  );
}
