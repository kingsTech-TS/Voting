// Server-only helpers for the Backend-for-Frontend routes. Never import from client components.
import { NextResponse, type NextRequest } from "next/server";
import type { ApiErrorBody, SessionOut, TokenOut } from "@/lib/api/types";
import { ACCESS_COOKIE, REFRESH_COOKIE, SESS_COOKIE, encodeSession } from "@/lib/session";

export const API_URL = (process.env.API_URL || "http://localhost:8000").replace(/\/+$/, "");

/** Number of proxies in front of this Next app whose X-Forwarded-For entries we trust (0 = none). */
const FRONT_PROXY_COUNT = Number(process.env.FRONT_PROXY_COUNT || "0");
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || "7");
/** COOKIE_SECURE=true|false forces it; otherwise Secure is set only when the request arrived over HTTPS. */
const COOKIE_SECURE = process.env.COOKIE_SECURE;

export function isSecureRequest(req: NextRequest): boolean {
  if (COOKIE_SECURE === "true") return true;
  if (COOKIE_SECURE === "false") return false;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || req.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

export function backendUrl(path: string, search = ""): string {
  return `${API_URL}/api/v1/${path.replace(/^\/+/, "")}${search}`;
}

/** Real client IP, using the same rule as the backend (trust only the last N hops). */
export function clientIp(req: NextRequest): string | null {
  if (FRONT_PROXY_COUNT <= 0) return null;
  const hops = (req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops.length === 0) return req.headers.get("x-real-ip");
  return hops.length >= FRONT_PROXY_COUNT ? hops[hops.length - FRONT_PROXY_COUNT] : hops[0];
}

/** Headers forwarded to FastAPI: client IP (for rate limits + audit logs), user agent, request id. */
export function forwardHeaders(req: NextRequest, accessToken?: string | null): Headers {
  const h = new Headers();
  const ip = clientIp(req);
  if (ip) h.set("x-forwarded-for", ip);
  const ua = req.headers.get("user-agent");
  if (ua) h.set("user-agent", ua);
  const rid = req.headers.get("x-request-id");
  if (rid) h.set("x-request-id", rid);
  if (accessToken) h.set("authorization", `Bearer ${accessToken}`);
  return h;
}

export function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ code, message } satisfies ApiErrorBody, { status });
}

/** Reject state-changing requests coming from another origin (CSRF defence on top of SameSite=Lax). */
export function checkOrigin(req: NextRequest): NextResponse | null {
  if (req.method === "GET" || req.method === "HEAD") return null;
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    // fall through
  }
  return errorJson(403, "BAD_ORIGIN", "Cross-origin request blocked.");
}

export function setSessionCookies(res: NextResponse, tokens: TokenOut, secure: boolean): void {
  const refreshMaxAge = REFRESH_DAYS * 24 * 3600;
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/session",
    maxAge: refreshMaxAge,
  });
  res.cookies.set(
    SESS_COOKIE,
    encodeSession({
      role: tokens.role,
      onboarding: tokens.onboarding_required,
      exp: Date.now() + tokens.expires_in * 1000,
    }),
    { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: refreshMaxAge },
  );
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { path: "/api/session", maxAge: 0 });
  res.cookies.set(SESS_COOKIE, "", { path: "/", maxAge: 0 });
}

/** POST JSON to the backend; returns the raw Response (or a 502 Response if unreachable). */
export async function postBackend(req: NextRequest, path: string, body: unknown, accessToken?: string | null): Promise<Response> {
  const headers = forwardHeaders(req, accessToken);
  headers.set("content-type", "application/json");
  try {
    return await fetch(backendUrl(path), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { code: "BACKEND_UNAVAILABLE", message: "The voting server is unreachable. Please try again shortly." },
      { status: 502 },
    );
  }
}

/** Turn a backend error Response into a NextResponse that keeps status, body and Retry-After. */
export async function relayError(upstream: Response): Promise<NextResponse> {
  let body: ApiErrorBody;
  try {
    body = await upstream.json();
  } catch {
    body = { code: "HTTP_ERROR", message: `Request failed (${upstream.status}).` };
  }
  const res = NextResponse.json(body, { status: upstream.status });
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) res.headers.set("retry-after", retryAfter);
  return res;
}

/** Successful login/refresh/onboarding: set cookies, return only role + onboarding to the browser. */
export async function sessionResponse(req: NextRequest, upstream: Response): Promise<NextResponse> {
  const tokens = (await upstream.json()) as TokenOut;
  const res = NextResponse.json({ role: tokens.role, onboarding_required: tokens.onboarding_required } satisfies SessionOut);
  setSessionCookies(res, tokens, isSecureRequest(req));
  return res;
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const data = await req.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
