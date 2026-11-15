import type { NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/session";
import { checkOrigin, clearSessionCookies, errorJson, postBackend, relayError, sessionResponse } from "@/lib/server/backend";

/**
 * Rotates the refresh token. The backend revokes every session if a rotated token is reused,
 * so the client serialises calls to this route across tabs (see lib/api/client.ts).
 */
export async function POST(req: NextRequest) {
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const res = errorJson(401, "NOT_AUTHENTICATED", "Please log in.");
    clearSessionCookies(res);
    return res;
  }

  const upstream = await postBackend(req, "auth/refresh", { refresh_token: refreshToken });
  if (!upstream.ok) {
    const res = await relayError(upstream);
    // Only drop the session when the backend rejected it (not when it was unreachable).
    if (upstream.status === 401 || upstream.status === 403) clearSessionCookies(res);
    return res;
  }
  return sessionResponse(req, upstream);
}
