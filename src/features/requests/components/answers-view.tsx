import { FileText, ImageIcon } from "lucide-react";
import type { FieldDefinition } from "@/features/forms/definitions";
import { formatDate, formatNumber } from "@/lib/utils";

type Attachment = { id: string; fieldName: string | null; fileName: string; mimeType: string; size: number };

/**
 * Renders a request's answers using the form snapshot stored with the request,
 * so answers stay readable even after the service form changes.
 */
export function AnswersView({
  fields,
  answers,
  attachments,
}: {
  fields: FieldDefinition[];
  answers: unknown;
  attachments: Attachment[];
}) {
  const values = (answers && typeof answers === "object" ? answers : {}) as Record<string, unknown>;

  if (fields.length === 0) return <p className="text-sm text-muted-foreground">این خدمت فیلد اختصاصی ندارد.</p>;

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <dt className="text-xs text-muted-foreground">{field.label}</dt>
          <dd className="text-sm font-medium break-words">
            {field.type === "FILE" ? (
              <AttachmentList attachments={attachments.filter((a) => a.fieldName === field.name)} />
            ) : (
              formatAnswer(field, values[field.name])
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatAnswer(field: FieldDefinition, value: unknown): string {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return "—";
  const optionLabel = (v: unknown) => field.options?.find((o) => o.value === v)?.label ?? String(v);
  switch (field.type) {
    case "BOOLEAN":
      return value === true ? "بله" : "خیر";
    case "NUMBER":
      return typeof value === "number" ? formatNumber(value) : String(value);
    case "DATE":
      return typeof value === "string" ? formatDate(`${value}T00:00:00Z`) : String(value);
    case "SELECT":
    case "RADIO":
      return optionLabel(value);
    case "CHECKBOX":
      return Array.isArray(value) ? value.map(optionLabel).join("، ") : String(value);
    default:
      return String(value);
  }
}

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-1">
      {attachments.map((a) => (
        <li key={a.id}>
          <a
            href={`/api/attachments/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            {a.mimeType.startsWith("image/") ? <ImageIcon className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
            <span className="max-w-56 truncate">{a.fileName}</span>
            <span className="text-xs text-muted-foreground">({formatNumber(Math.ceil(a.size / 1024))} KB)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
