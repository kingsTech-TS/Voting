import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/session";
import { checkOrigin, errorJson, postBackend, readJson, relayError, sessionResponse } from "@/lib/server/backend";

/**
 * Admin first-login setup. The backend revokes the old tokens and returns new ones,
 * so the cookies must be replaced here (it can't go through the generic pass-through).
 */
export async function POST(req: NextRequest) {
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const body = await readJson(req);
  if (!body) return errorJson(400, "BAD_REQUEST", "Invalid request.");

  const upstream = await postBackend(req, "admin/onboarding", body, req.cookies.get(ACCESS_COOKIE)?.value);
  if (!upstream.ok) return relayError(upstream);
  return sessionResponse(req, upstream);
}
