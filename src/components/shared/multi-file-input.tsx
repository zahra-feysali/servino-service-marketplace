"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { FileText, ImageIcon, Plus, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toPersianDigits } from "@/lib/utils";

export type FileRules = { accept: readonly string[]; maxBytes: number; maxFiles: number };

const TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toPersianDigits(Math.round(bytes / 1024))} کیلوبایت`;
  return `${(bytes / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
}

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

/**
 * Pure merge used by the input (exported for tests): appends picked files to the current list,
 * skipping duplicates and rejecting wrong types, oversize files and anything over the count limit.
 */
export function mergeFiles(current: File[], picked: File[], rules: FileRules): { files: File[]; errors: string[] } {
  const errors: string[] = [];
  const next = [...current];
  const seen = new Set(current.map(fileKey));
  for (const f of picked) {
    if (seen.has(fileKey(f))) continue;
    if (!rules.accept.includes(f.type)) {
      errors.push(`نوع فایل «${f.name}» مجاز نیست.`);
      continue;
    }
    if (f.size <= 0) {
      errors.push(`فایل «${f.name}» خالی است.`);
      continue;
    }
    if (f.size > rules.maxBytes) {
      errors.push(`حجم «${f.name}» بیش از ${formatFileSize(rules.maxBytes)} است.`);
      continue;
    }
    if (next.length >= rules.maxFiles) {
      errors.push(`حداکثر ${toPersianDigits(rules.maxFiles)} فایل مجاز است؛ «${f.name}» اضافه نشد.`);
      continue;
    }
    next.push(f);
    seen.add(fileKey(f));
  }
  return { files: next, errors };
}

type Props = {
  id: string;
  rules: FileRules;
  /** Controlled list. Omit for uncontrolled use inside a native/ServerForm form (requires `name`). */
  files?: File[];
  onChange?: (files: File[]) => void;
  /** When set, the selected files are mirrored into a hidden `<input type="file" name>` so plain FormData includes them. */
  name?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
};

/**
 * Multi-file picker: choose several files at once, add more later, drag & drop, image previews,
 * name/type/size, remove before sending, and client-side checks (server re-validates everything).
 */
export function MultiFileInput({ id, rules, files: controlled, onChange, name, invalid, disabled, describedBy }: Props) {
  const [internal, setInternal] = useState<File[]>([]);
  const files = controlled ?? internal;
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLInputElement>(null);

  function update(next: File[]) {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  function add(list: FileList | File[] | null | undefined) {
    // Copy synchronously: the FileList is live and is cleared when the input is reset.
    const picked = list ? Array.from(list) : [];
    if (picked.length === 0) return;
    const r = mergeFiles(files, picked, rules);
    setErrors(r.errors);
    update(r.files);
  }

  function remove(index: number) {
    setErrors([]);
    update(files.filter((_, i) => i !== index));
  }

  // Mirror into the hidden named input (DataTransfer is supported by all modern browsers).
  useEffect(() => {
    if (!name || !mirrorRef.current) return;
    try {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      mirrorRef.current.files = dt.files;
    } catch {
      // Very old browsers: the controlled list is still sent by custom submit handlers.
    }
  }, [files, name]);

  // Clear the uncontrolled list when the surrounding form is reset (e.g. after a successful upload).
  useEffect(() => {
    const form = pickerRef.current?.form;
    if (!form || controlled) return;
    const onReset = () => {
      setInternal([]);
      setErrors([]);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled]);

  const full = files.length >= rules.maxFiles;
  const typesText = rules.accept.map((m) => TYPE_LABELS[m] ?? m).join("، ");

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !full) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-5 text-center transition-colors",
          dragging && "border-primary bg-primary/5",
          invalid && "border-destructive",
          (disabled || full) && "opacity-70",
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm">
          {full ? "به حداکثر تعداد فایل رسیده‌اید." : "فایل‌ها را اینجا رها کنید یا انتخاب کنید"}
        </p>
        <p className="text-xs text-muted-foreground">
          حداکثر {toPersianDigits(rules.maxFiles)} فایل · هر فایل تا {formatFileSize(rules.maxBytes)} · {typesText}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || full}
          onClick={() => pickerRef.current?.click()}
          aria-describedby={describedBy}
          aria-controls={`${id}-list`}
        >
          <Plus />
          {files.length ? "افزودن فایل دیگر" : rules.maxFiles > 1 ? "انتخاب فایل‌ها" : "انتخاب فایل"}
        </Button>
        <input
          ref={pickerRef}
          id={id}
          type="file"
          className="sr-only"
          tabIndex={-1}
          multiple={rules.maxFiles > 1}
          accept={rules.accept.join(",")}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        {name ? <input ref={mirrorRef} type="file" name={name} multiple className="hidden" tabIndex={-1} aria-hidden /> : null}
      </div>

      {files.length > 0 ? (
        <ul id={`${id}-list`} className="grid gap-2 sm:grid-cols-2" aria-label="فایل‌های انتخاب‌شده">
          {files.map((f, i) => (
            <FileChip key={fileKey(f)} file={f} onRemove={() => remove(i)} disabled={disabled} />
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {toPersianDigits(files.length)} از {toPersianDigits(rules.maxFiles)} فایل انتخاب شده
        </p>
      ) : null}

      {errors.length ? (
        <ul role="alert" className="space-y-0.5 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FileChip({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  const isImage = file.type.startsWith("image/");
  const imgRef = useRef<HTMLImageElement>(null);
  // The object URL is created and revoked in the same effect (safe with StrictMode's
  // mount → unmount → mount) and applied directly to the <img> element.
  useEffect(() => {
    const img = imgRef.current;
    if (!isImage || !img) return;
    const u = URL.createObjectURL(file);
    img.src = u;
    return () => {
      img.removeAttribute("src");
      URL.revokeObjectURL(u);
    };
  }, [file, isImage]);

  return (
    <li className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-2">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not optimisable
          <img ref={imgRef} alt={`پیش‌نمایش ${file.name}`} className="size-full object-cover" />
        ) : file.type === "application/pdf" ? (
          <FileText className="size-5 text-muted-foreground" aria-hidden />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" dir="auto" title={file.name}>
          {file.name}
        </span>
        <span className="block text-xs text-muted-foreground">
          {TYPE_LABELS[file.type] ?? "فایل"} · {formatFileSize(file.size)}
        </span>
      </span>
      <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove} disabled={disabled} aria-label={`حذف ${file.name}`}>
        <X />
      </Button>
    </li>
  );
}
