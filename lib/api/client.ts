"use client";

import { toast } from "sonner";
import { noteServerDate } from "@/lib/time";
import { homeFor, loginPathFor, readSession } from "@/lib/session";
import type { SessionOut } from "./types";
import { ApiError, NETWORK_ERROR, REFRESHABLE_CODES, SESSION_LOST_CODES, parseErrorResponse } from "./errors";

const LOCK_NAME = "voting-session-refresh";
const FLASH_KEY = "voting-flash";

// ---- refresh (single-flight within a tab, serialised across tabs) ---------------------------------

let inflight: Promise<boolean> | null = null;

/**
 * Refresh the session. `seenExp` is the access-token expiry the caller saw before its request
 * failed; if the cookie already shows a later expiry, another tab refreshed and we skip the call.
 * The backend revokes *all* sessions when a rotated refresh token is reused, so this must never
 * run twice concurrently.
 */
export function refreshSession(seenExp?: number): Promise<boolean> {
  if (inflight) return inflight;
  const run = async (): Promise<boolean> => {
    const current = readSession();
    if (!current) return false;
    if (seenExp !== undefined && current.exp > seenExp) return true;
    try {
      const res = await fetch("/api/session/refresh", { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  };
  inflight = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.locks) {
        return await navigator.locks.request(LOCK_NAME, run);
      }
      return await run();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Clear the session and send the user to the right login page with a message. */
export async function endSession(message?: string): Promise<void> {
  const role = readSession()?.role;
  try {
    await fetch("/api/session/logout", { method: "POST" });
  } catch {
    // ignore
  }
  if (message) {
    try {
      sessionStorage.setItem(FLASH_KEY, message);
    } catch {
      // ignore
    }
  }
  window.location.assign(loginPathFor(role));
}

/** Message left by endSession() for the login page to show. */
export function takeFlash(): string | null {
  try {
    const msg = sessionStorage.getItem(FLASH_KEY);
    if (msg) sessionStorage.removeItem(FLASH_KEY);
    return msg;
  } catch {
    return null;
  }
}

let redirecting = false;

function handleGlobalError(err: ApiError): void {
  if (redirecting) return;
  if (SESSION_LOST_CODES.has(err.code)) {
    redirecting = true;
    void endSession(err.message);
  } else if (err.code === "ONBOARDING_REQUIRED" || err.code === "PROFILE_PICTURE_REQUIRED") {
    const target = err.code === "ONBOARDING_REQUIRED" ? "/admin/onboarding" : "/student/onboarding";
    if (window.location.pathname === target) return; // already there: never loop
    redirecting = true;
    window.location.assign(target);
  }
}

// ---- requests -------------------------------------------------------------------------------------

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  json?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: ApiOptions["query"]): string {
  const url = `/api/v1/${path.replace(/^\/+/, "")}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function send(path: string, opts: ApiOptions): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  try {
    const res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      signal: opts.signal,
      cache: "no-store",
    });
    noteServerDate(res.headers.get("date"));
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw NETWORK_ERROR;
  }
}

/** Call the backend through the BFF. Throws ApiError; refreshes and retries once on an expired token. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const seenExp = readSession()?.exp;
  let res = await send(path, opts);

  if (res.status === 401) {
    const err = await parseErrorResponse(res);
    if (!REFRESHABLE_CODES.has(err.code) || !readSession()) {
      handleGlobalError(err);
      throw err;
    }
    const ok = await refreshSession(seenExp);
    if (!ok) {
      if (!redirecting) {
        redirecting = true;
        void endSession("Your session has expired. Please log in again.");
      }
      throw err;
    }
    res = await send(path, opts);
  }

  if (!res.ok) {
    const err = await parseErrorResponse(res);
    handleGlobalError(err);
    throw err;
  }
  return (await res.json()) as T;
}

// ---- session routes -------------------------------------------------------------------------------

async function sessionPost(path: string, body?: unknown): Promise<SessionOut> {
  let res: Response;
  try {
    res = await fetch(`/api/session/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw NETWORK_ERROR;
  }
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as SessionOut;
}

export function loginStudent(identifier: string, password: string): Promise<SessionOut> {
  return sessionPost("login", { kind: "student", identifier, password });
}

export function loginStaff(email: string, password: string): Promise<SessionOut> {
  return sessionPost("login", { kind: "staff", email, password });
}

export function completeAdminOnboarding(body: {
  full_name: string;
  current_password: string;
  new_password: string;
  confirm_password: string;
}): Promise<SessionOut> {
  return sessionPost("onboarding", body);
}

/** Force a refresh so the `sess` cookie picks up new onboarding state (e.g. after the profile picture). */
export async function reloadSession(): Promise<SessionOut | null> {
  const ok = await refreshSession();
  const s = readSession();
  return ok && s ? { role: s.role, onboarding_required: s.onboarding } : null;
}

export async function logout(): Promise<void> {
  const role = readSession()?.role;
  try {
    await fetch("/api/session/logout", { method: "POST" });
  } catch {
    // ignore
  }
  toast.success("You have been logged out.");
  window.location.assign(loginPathFor(role));
}

export { homeFor };
