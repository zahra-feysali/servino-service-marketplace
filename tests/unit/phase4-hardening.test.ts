import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isSafeRelativePath, resolvePostLoginRedirect } from "@/features/auth/rbac";
import { simulatedPaymentsEnabled } from "@/features/payments/rules";
import { pageArgs, pageHref, parsePage, toPaginated } from "@/lib/pagination";
import { clientIpFrom, createRateLimiter } from "@/lib/rate-limit";
import { bodySizeError, isSameOriginRequest } from "@/lib/request-guards";

describe("open-redirect protection", () => {
  it.each(["/\t/evil.com", "/\n/evil.com", "/\\evil.com", "//evil.com", "https://evil.com", "/%09/evil.com\u0000", "javascript:alert(1)"])(
    "rejects %j",
    (raw) => {
      expect(isSafeRelativePath(raw)).toBe(false);
      expect(resolvePostLoginRedirect(raw, "CUSTOMER")).toBe("/dashboard/customer");
    },
  );

  it("accepts normal relative paths", () => {
    expect(isSafeRelativePath("/services/plumbing?x=1#top")).toBe(true);
    expect(isSafeRelativePath("/%2F%2Fevil.com")).toBe(true); // encoded slashes stay a same-origin path
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and resets after the window", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
    expect([1, 2, 3].map(() => rl.hit("k").allowed)).toEqual([true, true, true]);
    expect(rl.isBlocked("k")).toBe(true);
    expect(rl.hit("k").allowed).toBe(false);
    expect(rl.isBlocked("other")).toBe(false);
    t = 1001;
    expect(rl.isBlocked("k")).toBe(false);
    expect(rl.hit("k").allowed).toBe(true);
    rl.reset("k");
    expect(rl.isBlocked("k")).toBe(false);
  });

  it("bounds memory by evicting old keys", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 10_000, maxKeys: 3, now: () => 0 });
    for (const k of ["a", "b", "c", "d", "e"]) rl.hit(k);
    expect(rl.isBlocked("a")).toBe(false); // evicted
    expect(rl.isBlocked("e")).toBe(true);
  });

  it("uses the proxy-appended (right-most) forwarded IP, not the client-supplied one", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.5" }))).toBe("10.0.0.5");
    expect(clientIpFrom(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIpFrom({ "x-forwarded-for": ["2.2.2.2"] })).toBe("2.2.2.2");
    expect(clientIpFrom(undefined)).toBe("unknown");
  });
});

describe("simulated payments switch", () => {
  it("is on in development, off in production unless explicitly allowed", () => {
    expect(simulatedPaymentsEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(simulatedPaymentsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(simulatedPaymentsEnabled({ NODE_ENV: "production", ALLOW_SIMULATED_PAYMENTS: "true" })).toBe(true);
    expect(simulatedPaymentsEnabled({ NODE_ENV: "development", ALLOW_SIMULATED_PAYMENTS: "false" })).toBe(false);
  });
});

describe("route handler guards", () => {
  const req = (headers: Record<string, string>) => new NextRequest("http://localhost:3000/api/requests", { method: "POST", headers });

  it("rejects cross-site requests", () => {
    expect(isSameOriginRequest(req({ origin: "http://localhost:3000" }))).toBe(true);
    expect(isSameOriginRequest(req({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("requires a bounded Content-Length", () => {
    expect(bodySizeError(req({}), 100)).toBe("LENGTH_REQUIRED");
    expect(bodySizeError(req({ "content-length": "abc" }), 100)).toBe("LENGTH_REQUIRED");
    expect(bodySizeError(req({ "content-length": "101" }), 100)).toBe("TOO_LARGE");
    expect(bodySizeError(req({ "content-length": "100" }), 100)).toBeNull();
  });
});

describe("pagination", () => {
  it("parses page numbers defensively", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
    expect(parsePage(["2"])).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("99999999")).toBe(10_000);
  });

  it("computes offsets, totals and links", () => {
    expect(pageArgs(3, 20)).toEqual({ skip: 40, take: 20 });
    expect(toPaginated([1], 41, 2, 20)).toMatchObject({ totalPages: 3, page: 2 });
    expect(toPaginated([], 0, 1).totalPages).toBe(1);
    expect(pageHref("/x", { status: "OPEN", page: "4", q: undefined }, 2)).toBe("/x?status=OPEN&page=2");
    expect(pageHref("/x", { status: "OPEN" }, 1)).toBe("/x?status=OPEN");
  });
});
