"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Check, CheckCheck, FileText, Loader2, Lock, Paperclip, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FileChip, formatFileSize, mergeFiles } from "@/components/shared/multi-file-input";
import { UploadProgress } from "@/components/shared/upload-progress";
import { postFormData } from "@/lib/upload-client";
import { formatDate, formatTime } from "@/lib/utils";
import type { ChatMessage } from "@/features/chat/service";
import { CHAT_FILE_MAX_BYTES, CHAT_MIME_TYPES, CHAT_POLL_INTERVAL_MS, MAX_CHAT_FILES, MAX_MESSAGE_LENGTH } from "@/features/chat/rules";

type Props = {
  conversationId: string;
  meId: string;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
  initialCounterpartReadAt: string | null;
  counterpart: { name: string; avatarUrl: string | null };
  canSend: boolean;
  closedReason?: string;
};

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };
type ReadPayload = { messages: ChatMessage[]; hasMore: boolean; counterpartReadAt: string | null };

const RULES = { accept: CHAT_MIME_TYPES, maxBytes: CHAT_FILE_MAX_BYTES, maxFiles: MAX_CHAT_FILES };

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Conversation view: history, polling every few seconds (no websockets needed), read ticks,
 * text + file messages with previews and upload progress. All access checks are server-side.
 */
export function ChatThread(props: Props) {
  const { conversationId, meId, counterpart, canSend } = props;
  const [messages, setMessages] = useState(props.initialMessages);
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [readAt, setReadAt] = useState(props.initialCounterpartReadAt);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<string | null>(props.initialMessages.at(-1)?.createdAt ?? null);
  const stickToBottom = useRef(true);

  const url = `/api/conversations/${conversationId}/messages`;

  const applyIncoming = useCallback((incoming: ChatMessage[], counterpartReadAt: string | null) => {
    setMessages((cur) => {
      const next = mergeMessages(cur, incoming);
      lastRef.current = next.at(-1)?.createdAt ?? lastRef.current;
      return next;
    });
    if (counterpartReadAt) setReadAt(counterpartReadAt);
  }, []);

  // Polling (TanStack Query pauses it while the tab is hidden).
  useQuery({
    queryKey: ["chat", conversationId],
    queryFn: async () => {
      const qs = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
      const res = await fetch(`${url}${qs}`, { cache: "no-store" });
      const json = (await res.json()) as Envelope<ReadPayload>;
      if (json.ok) applyIncoming(json.data.messages, json.data.counterpartReadAt);
      return Date.now();
    },
    refetchInterval: CHAT_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Keep the view pinned to the newest message unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const res = await fetch(`${url}?before=${encodeURIComponent(first.createdAt)}`, { cache: "no-store" });
      const json = (await res.json()) as Envelope<ReadPayload>;
      if (json.ok) {
        setMessages((cur) => mergeMessages(cur, json.data.messages));
        setHasMore(json.data.hasMore);
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  function addFiles(list: FileList | null) {
    const picked = list ? Array.from(list) : [];
    const r = mergeFiles(files, picked, RULES);
    setFiles(r.files);
    setFileErrors(r.errors);
  }

  async function send() {
    const text = body.trim();
    if (sending || (!text && files.length === 0)) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      toast.error(`حداکثر ${MAX_MESSAGE_LENGTH.toLocaleString("fa-IR")} نویسه مجاز است.`);
      return;
    }
    const form = new FormData();
    form.set("body", text);
    files.forEach((f) => form.append("files", f));
    setSending(true);
    setProgress(files.length ? 0 : null);
    const r = await postFormData<ChatMessage>(url, form, files.length ? setProgress : undefined);
    setSending(false);
    setProgress(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    stickToBottom.current = true;
    applyIncoming([r.data], null);
    setBody("");
    setFiles([]);
    setFileErrors([]);
  }

  const days = messages.map((m) => formatDate(m.createdAt));

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-5" aria-live="polite" aria-label="پیام‌ها">
        {hasMore ? (
          <div className="flex justify-center">
            <Button type="button" variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? <Loader2 className="animate-spin" /> : null}
              پیام‌های قدیمی‌تر
            </Button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div className="space-y-2">
              <UserAvatar name={counterpart.name} src={counterpart.avatarUrl} size="lg" className="mx-auto" />
              <p>هنوز پیامی رد و بدل نشده است. گفتگو با {counterpart.name} را شروع کنید.</p>
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => {
          const mine = m.senderId === meId;
          const day = days[i];
          const showDay = i === 0 || day !== days[i - 1];
          const seen = mine && (m.readAt || (readAt && m.createdAt <= readAt));
          return (
            <Fragment key={m.id}>
              {showDay ? (
                <div className="flex justify-center py-1">
                  <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">{day}</span>
                </div>
              ) : null}
              <div className={cn("flex items-end gap-2", mine ? "justify-start" : "flex-row-reverse justify-start")}>
                {!mine ? <UserAvatar name={counterpart.name} src={counterpart.avatarUrl} size="xs" className="mb-1" /> : null}
                <div
                  className={cn(
                    "max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm shadow-xs sm:max-w-[70%]",
                    mine ? "rounded-ee-md bg-primary text-primary-foreground" : "rounded-es-md bg-muted",
                  )}
                >
                  {m.attachments.length ? <Attachments items={m.attachments} mine={mine} /> : null}
                  {m.body ? <p className="whitespace-pre-wrap break-words leading-7">{m.body}</p> : null}
                  <p className={cn("flex items-center justify-end gap-1 text-[0.7rem]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {formatTime(m.createdAt)}
                    {mine ? (
                      seen ? <CheckCheck className="size-3.5" aria-label="خوانده شد" /> : <Check className="size-3.5" aria-label="ارسال شد" />
                    ) : null}
                  </p>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {canSend ? (
        <form
          className="space-y-2 border-t bg-background/60 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {files.length ? (
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="فایل‌های پیوست">
              {files.map((f, i) => (
                <FileChip key={`${f.name}:${f.size}:${f.lastModified}`} file={f} disabled={sending} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />
              ))}
            </ul>
          ) : null}
          {fileErrors.length ? (
            <ul role="alert" className="text-xs text-destructive">
              {fileErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {progress !== null ? <UploadProgress percent={progress} /> : null}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => pickerRef.current?.click()}
              disabled={sending || files.length >= MAX_CHAT_FILES}
              aria-label="پیوست فایل"
              title={`پیوست تصویر یا PDF (حداکثر ${MAX_CHAT_FILES.toLocaleString("fa-IR")} فایل، هر کدام تا ${formatFileSize(CHAT_FILE_MAX_BYTES)})`}
            >
              <Paperclip />
            </Button>
            <input
              ref={pickerRef}
              type="file"
              multiple
              accept={CHAT_MIME_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <label htmlFor={`chat-input-${conversationId}`} className="sr-only">
              متن پیام
            </label>
            <Textarea
              id={`chat-input-${conversationId}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="پیام خود را بنویسید… (Shift+Enter برای خط جدید)"
              className="max-h-40 min-h-10 flex-1 resize-none"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || (!body.trim() && files.length === 0)} aria-label="ارسال پیام">
              {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal className="rtl:-scale-x-100" />}
            </Button>
          </div>
        </form>
      ) : (
        <p className="flex items-center gap-2 border-t bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden />
          {props.closedReason}
        </p>
      )}
    </div>
  );
}

function Attachments({ items, mine }: { items: ChatMessage["attachments"]; mine: boolean }) {
  const images = items.filter((a) => a.mimeType.startsWith("image/"));
  const others = items.filter((a) => !a.mimeType.startsWith("image/"));
  return (
    <div className="space-y-2">
      {images.length ? (
        <div className={cn("grid gap-1.5", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.map((a) => (
            <a key={a.id} href={`/api/chat-files/${a.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
              <img src={`/api/chat-files/${a.id}`} alt={a.fileName} loading="lazy" className="max-h-56 w-full object-cover" />
            </a>
          ))}
        </div>
      ) : null}
      {others.map((a) => (
        <a
          key={a.id}
          href={`/api/chat-files/${a.id}?download=1`}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
            mine ? "bg-primary-foreground/15 hover:bg-primary-foreground/25" : "bg-background hover:bg-background/70",
          )}
        >
          <FileText className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate" dir="auto">
            {a.fileName}
          </span>
          <span className="shrink-0 opacity-80">{formatFileSize(a.size)}</span>
        </a>
      ))}
    </div>
  );
}
