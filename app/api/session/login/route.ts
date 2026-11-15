import type { NextRequest } from "next/server";
import { checkOrigin, errorJson, postBackend, readJson, relayError, sessionResponse } from "@/lib/server/backend";

/** POST {kind: "student", identifier, password} | {kind: "staff", email, password} */
export async function POST(req: NextRequest) {
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const body = await readJson(req);
  if (!body) return errorJson(400, "BAD_REQUEST", "Invalid request.");

  const { kind, ...credentials } = body;
  let path: string;
  if (kind === "student") path = "auth/student/login";
  else if (kind === "staff") path = "auth/staff/login";
  else return errorJson(400, "BAD_REQUEST", "Invalid login type.");

  const upstream = await postBackend(req, path, credentials);
  if (!upstream.ok) return relayError(upstream);
  return sessionResponse(req, upstream);
}
