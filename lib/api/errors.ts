import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  /** Seconds, from the Retry-After header (429s). */
  retryAfter?: number;
  /** Epoch ms when a 429 can be retried (fixed when the error is created). */
  retryAt?: number;
  requestId?: string;

  constructor(status: number, body: ApiErrorBody, retryAfter?: number, requestId?: string) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.retryAfter = retryAfter;
    if (status === 429) this.retryAt = Date.now() + (retryAfter ?? 60) * 1000;
    this.requestId = requestId;
  }

  /** Field name from a 422 VALIDATION_ERROR (`details[0].loc` = ["body", "<field>"]). */
  get field(): string | undefined {
    if (this.code !== "VALIDATION_ERROR" || !Array.isArray(this.details)) return undefined;
    const loc = (this.details[0] as { loc?: string[] } | undefined)?.loc;
    return loc && loc.length > 1 ? loc[loc.length - 1] : undefined;
  }
}

export const NETWORK_ERROR = new ApiError(0, {
  code: "NETWORK_ERROR",
  message: "Could not reach the server. Check your connection and try again.",
});

/** Codes that mean "the session is gone": log out and go to the login page. */
export const SESSION_LOST_CODES = new Set(["TOKEN_REVOKED", "ACCOUNT_SUSPENDED"]);

/** 401 codes that a token refresh can fix. */
export const REFRESHABLE_CODES = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "NOT_AUTHENTICATED"]);

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function parseErrorResponse(res: Response): Promise<ApiError> {
  let body: ApiErrorBody = { code: "HTTP_ERROR", message: `Request failed (${res.status}).` };
  try {
    const data = await res.json();
    if (data && typeof data.code === "string" && typeof data.message === "string") body = data;
  } catch {
    // non-JSON error body
  }
  const ra = res.headers.get("retry-after");
  const retryAfter = ra && /^\d+$/.test(ra) ? Number(ra) : undefined;
  return new ApiError(res.status, body, retryAfter, res.headers.get("x-request-id") ?? undefined);
}
