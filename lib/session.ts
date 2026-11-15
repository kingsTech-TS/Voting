// The non-httpOnly `sess` cookie: {role, onboarding, exp}. No secrets — it only drives optimistic
// redirects (proxy.ts) and tells the client when the access token expires. The backend is the authority.
import type { Onboarding, Role } from "@/lib/api/types";

export const SESS_COOKIE = "sess";
export const ACCESS_COOKIE = "at";
export const REFRESH_COOKIE = "rt";

export interface SessionInfo {
  role: Role;
  onboarding: Onboarding;
  /** Access token expiry, epoch ms. */
  exp: number;
}

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

export function encodeSession(info: SessionInfo): string {
  return toBase64Url(JSON.stringify(info));
}

export function decodeSession(raw: string | undefined | null): SessionInfo | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(fromBase64Url(raw));
    if (data && typeof data.role === "string" && typeof data.exp === "number") return data as SessionInfo;
  } catch {
    // ignore malformed cookie
  }
  return null;
}

/** Browser only. */
export function readSession(): SessionInfo | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${SESS_COOKIE}=`));
  return decodeSession(match?.slice(SESS_COOKIE.length + 1));
}

export function homeFor(role: Role, onboarding: Onboarding = null): string {
  if (onboarding === "profile_picture") return "/student/onboarding";
  if (onboarding === "change_password") return "/admin/onboarding";
  if (role === "student") return "/student";
  if (role === "admin") return "/admin";
  return "/super-admin";
}

export function loginPathFor(role: Role | null | undefined): string {
  return role === "student" ? "/login" : "/staff/login";
}
