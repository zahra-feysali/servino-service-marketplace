/**
 * Small fixed-window rate limiter (in-process memory).
 * Used to slow down credential stuffing on login and mass registration.
 * Limitation: counters are per server process — behind several instances use a shared
 * store (documented in IMPLEMENTATION_STATUS.md).
 */
export type RateLimiter = {
  /** Registers one attempt; returns whether it is allowed and seconds until the window resets. */
  hit(key: string): { allowed: boolean; retryAfterSec: number };
  /** True when the key already used up its attempts in the current window (does not count). */
  isBlocked(key: string): boolean;
  reset(key: string): void;
};

export function createRateLimiter(options: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function sweep(t: number) {
    if (buckets.size < maxKeys) return;
    for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
    // Still too many keys: drop the oldest entries (Map preserves insertion order).
    while (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value!);
  }

  return {
    hit(key) {
      const t = now();
      let b = buckets.get(key);
      if (!b || b.resetAt <= t) {
        sweep(t);
        b = { count: 0, resetAt: t + options.windowMs };
        buckets.set(key, b);
      }
      b.count++;
      return { allowed: b.count <= options.limit, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - t) / 1000)) };
    },
    isBlocked(key) {
      const b = buckets.get(key);
      return !!b && b.resetAt > now() && b.count >= options.limit;
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

const globalForLimits = globalThis as unknown as { __servinoLimiters?: Record<string, RateLimiter> };
globalForLimits.__servinoLimiters ??= {};

/** Process-wide named limiters (survive dev hot reloads). */
export function namedLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  const store = globalForLimits.__servinoLimiters!;
  store[name] ??= createRateLimiter({ limit, windowMs });
  return store[name];
}

/**
 * Best-effort client IP (only used as a rate-limit key, never for authorization).
 * Prefers `x-real-ip` set by the reverse proxy; otherwise takes the *right-most* `x-forwarded-for`
 * entry — the one appended by our own proxy — because left-most entries are client-controlled.
 */
export function clientIpFrom(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  if (!headers) return "unknown";
  const get = (k: string) => (headers instanceof Headers ? headers.get(k) : ([] as string[]).concat(headers[k] ?? [])[0] ?? null);
  const realIp = get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const chain = get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return chain[chain.length - 1] || "unknown";
}
