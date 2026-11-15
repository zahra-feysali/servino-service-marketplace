/**
 * Shared error types and the uniform result shape returned by Server Actions.
 * Server Actions never throw raw errors to the client: they return ActionResult.
 */

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: FieldErrors): { ok: false; error: string; fieldErrors?: FieldErrors } {
  return { ok: false, error, fieldErrors };
}

/** Expected business-rule violation; message is safe to show to the user (Persian). */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(message = "برای ادامه وارد حساب کاربری شوید.") {
    super(message, "UNAUTHENTICATED");
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "شما مجوز انجام این عملیات را ندارید.") {
    super(message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "مورد درخواستی یافت نشد.") {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

/** Prisma unique-constraint violation (P2002) detection without importing runtime internals. */
export function isUniqueConstraintError(error: unknown): error is { code: "P2002"; meta?: { target?: unknown } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Converts any thrown error into a safe ActionResult. Unknown errors are logged
 * server-side and replaced by a generic message (never leak internals).
 */
export function toActionError(error: unknown): { ok: false; error: string; fieldErrors?: FieldErrors } {
  if (error instanceof AppError) {
    return fail(error.message, error.fieldErrors);
  }
  console.error("[action:error]", error);
  return fail("خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.");
}
