import { NextResponse, type NextRequest } from "next/server";
import { SESS_COOKIE, decodeSession, homeFor } from "@/lib/session";

/**
 * Optimistic routing only, based on the non-secret `sess` cookie.
 * The backend re-checks every request; the client handles 401/403 codes.
 */

const AREAS: { prefix: string; role: "student" | "admin" | "super_admin"; login: string }[] = [
  { prefix: "/student", role: "student", login: "/login" },
  { prefix: "/super-admin", role: "super_admin", login: "/staff/login" },
  { prefix: "/admin", role: "admin", login: "/staff/login" },
];
const GUEST_ONLY = ["/login", "/register", "/staff/login"];

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESS_COOKIE)?.value);
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  if (GUEST_ONLY.some((p) => under(pathname, p))) {
    return session ? redirect(homeFor(session.role, session.onboarding)) : NextResponse.next();
  }

  const area = AREAS.find((a) => under(pathname, a.prefix));
  if (!area) return NextResponse.next();
  if (!session) {
    const url = new URL(area.login, request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session.role !== area.role) return redirect(homeFor(session.role, session.onboarding));

  if (session.onboarding === "profile_picture" && pathname !== "/student/onboarding") {
    return redirect("/student/onboarding");
  }
  if (session.onboarding === "change_password" && pathname !== "/admin/onboarding") {
    return redirect("/admin/onboarding");
  }
  if (!session.onboarding && (pathname === "/student/onboarding" || pathname === "/admin/onboarding")) {
    return redirect(homeFor(session.role));
  }
  return NextResponse.next();
}

export const config = {
  // Never run on API routes (keeps upload bodies streaming) or static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
