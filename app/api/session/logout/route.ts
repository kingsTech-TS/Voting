import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/session";
import { checkOrigin, clearSessionCookies, postBackend } from "@/lib/server/backend";

export async function POST(req: NextRequest) {
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await postBackend(req, "auth/logout", { refresh_token: refreshToken }); // best effort
  }
  const res = NextResponse.json({ code: "LOGGED_OUT", message: "You have been logged out." });
  clearSessionCookies(res);
  return res;
}
