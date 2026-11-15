import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/session";
import { backendUrl, checkOrigin, errorJson, forwardHeaders } from "@/lib/server/backend";

/**
 * Generic pass-through to FastAPI. Adds the bearer token from the httpOnly cookie, forwards the
 * client IP, and streams both request bodies (multipart uploads) and responses (SSE).
 */

const ALLOWED_ROOTS = new Set(["auth", "students", "elections", "admin", "super-admin", "live"]);
// Token-issuing routes go through /api/session/* so the cookies get set there.
const BLOCKED = new Set([
  "auth/staff/login",
  "auth/student/login",
  "auth/refresh",
  "auth/logout",
  "admin/onboarding",
]);
const PASS_RESPONSE_HEADERS = ["content-type", "retry-after", "x-request-id", "cache-control", "date"];

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const joined = path.join("/");
  if (!ALLOWED_ROOTS.has(path[0]) || BLOCKED.has(joined) || path.some((p) => p === ".." || p === ".")) {
    return errorJson(404, "NOT_FOUND", "Not found.");
  }
  const blocked = checkOrigin(req);
  if (blocked) return blocked;

  const headers = forwardHeaders(req, req.cookies.get(ACCESS_COOKIE)?.value);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType); // keeps the multipart boundary
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.body !== null;
  let upstream: Response;
  try {
    upstream = await fetch(backendUrl(joined, req.nextUrl.search), {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // Required by Node's fetch to stream a request body.
      ...(hasBody ? { duplex: "half" } : {}),
      signal: req.signal,
      redirect: "manual",
      cache: "no-store",
    } as RequestInit);
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error("Backend request failed", err);
    return errorJson(502, "BACKEND_UNAVAILABLE", "The voting server is unreachable. Please try again shortly.");
  }

  const out = new Headers();
  for (const name of PASS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  if ((upstream.headers.get("content-type") || "").includes("text/event-stream")) {
    out.set("cache-control", "no-cache, no-transform");
    out.set("x-accel-buffering", "no");
    out.set("connection", "keep-alive");
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
