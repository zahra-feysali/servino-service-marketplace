import type { NextRequest } from "next/server";

/**
 * CSRF defence for state-changing Route Handlers: the request must come from our own origin.
 * Browsers always send `Origin` and/or `Sec-Fetch-Site` on cross-site POSTs, so any cross-site
 * signal rejects the request (session cookies are additionally SameSite=Lax).
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  return true;
}

/**
 * Body size guard. Requests without a Content-Length (e.g. chunked uploads) are rejected
 * so `request.formData()` can never buffer an unbounded body.
 */
export function bodySizeError(request: NextRequest, maxBytes: number): "LENGTH_REQUIRED" | "TOO_LARGE" | null {
  const raw = request.headers.get("content-length");
  if (raw === null) return "LENGTH_REQUIRED";
  const length = Number(raw);
  if (!Number.isFinite(length) || length < 0) return "LENGTH_REQUIRED";
  return length > maxBytes ? "TOO_LARGE" : null;
}
