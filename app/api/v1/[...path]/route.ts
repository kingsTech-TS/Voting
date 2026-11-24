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
// The live stream (EventSource) can't use the Authorization header on the backend: it takes a single-use
// ticket in the URL instead. The ticket is fetched here, server-side, so it never reaches the browser.
const LIVE_STREAM = /^live\/elections\/([^/]+)\/stream$/;
const LIVE_TICKET = /^live\/elections\/[^/]+\/stream-ticket$/;

/** Swap the cookie's access token for a stream ticket. Returns the query string, or the backend's error. */
async function streamTicketSearch(req: NextRequest, electionId: string, headers: Headers): Promise<string | Response> {
  const upstream = await fetch(backendUrl(`live/elections/${electionId}/stream-ticket`), {
    method: "POST",
    headers,
    signal: req.signal,
    cache: "no-store",
  });
  if (!upstream.ok) {
    const out = new Headers({ "content-type": upstream.headers.get("content-type") || "application/json" });
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) out.set("retry-after", retryAfter);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  }
  const { ticket } = (await upstream.json()) as { ticket: string };
  return `?ticket=${encodeURIComponent(ticket)}`;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const joined = path.join("/");
  if (
    !ALLOWED_ROOTS.has(path[0]) ||
    BLOCKED.has(joined) ||
    LIVE_TICKET.test(joined) || // tickets are only ever handled here, server-side
    path.some((p) => p === ".." || p === ".")
  ) {
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
  const live = req.method === "GET" ? LIVE_STREAM.exec(joined) : null;
  let upstream: Response;
  try {
    let search = req.nextUrl.search;
    if (live) {
      const ticket = await streamTicketSearch(req, live[1], headers);
      if (typeof ticket !== "string") return ticket;
      search = ticket;
      headers.delete("authorization"); // the ticket is the credential for the stream itself
    }
    upstream = await fetch(backendUrl(joined, search), {
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
