"use client";

import type { ActionResult } from "@/lib/errors";

/**
 * POSTs multipart FormData with upload progress (XMLHttpRequest — fetch has no upload progress).
 * Always resolves to an ActionResult; network/parse failures become a Persian error message.
 */
export function postFormData<T = unknown>(
  url: string,
  body: FormData,
  onProgress?: (percent: number) => void,
): Promise<ActionResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      const r = xhr.response as ActionResult<T> | null;
      if (r && typeof r === "object" && "ok" in r) resolve(r);
      else if (xhr.status === 413) resolve({ ok: false, error: "حجم فایل‌ها بیش از حد مجاز است." });
      else resolve({ ok: false, error: "پاسخ نامعتبر از سرور دریافت شد. لطفاً دوباره تلاش کنید." });
    };
    xhr.onerror = () => resolve({ ok: false, error: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید." });
    xhr.onabort = () => resolve({ ok: false, error: "بارگذاری لغو شد." });
    xhr.send(body);
  });
}
