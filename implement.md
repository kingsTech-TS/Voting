# Voting Frontend — Implementation Plan

**Frontend:** this repo (`voting/`): Next.js 16.4 (App Router, `cacheComponents` + `partialPrefetching` on), React 19.3, Tailwind 4, Bun.
**Backend:** `../voting-BD`: FastAPI under `/api/v1`, MongoDB, Redis, Cloudinary. The backend is feature-complete per its own `implementation.md`. This plan covers the UI that uses it.
**Roles:** `student`, `admin`, `super_admin`.

> Before writing code, read the relevant guides in `node_modules/next/dist/docs/` (see `AGENTS.md`). This Next version renames Middleware to **Proxy** (`proxy.ts`). With `cacheComponents`, reading `cookies()` outside a `<Suspense>` boundary is a build error. Key guides: `01-app/02-guides/authentication-with-cache-components.md`, `01-app/02-guides/backend-for-frontend.md`, `01-app/01-getting-started/15-route-handlers.md`, `01-app/01-getting-started/16-proxy.md`.

---

## 1. What the backend gives us (contract summary)

### 1.1 Conventions
- Base path `/api/v1`. Health check: `GET /health` (outside `/api/v1`).
- **Every error** has the shape `{ code: string, message: string, details?: unknown }`. Show `message` and branch on `code`. Validation errors are `422 VALIDATION_ERROR`, and `message` is already human-readable (the first error).
- Tokens come back in the **response body** (`TokenOut`), not as cookies. Access tokens last 15 minutes and refresh tokens last 7 days.
- **Refresh tokens rotate and detect reuse.** If an already-used refresh token is presented again, the backend revokes **every** session for that user. Two tabs refreshing at the same time will therefore log the user out everywhere. The frontend **must** serialise refreshes (see §3.3).
- All timestamps are UTC ISO strings. The backend formats its own messages in `Africa/Lagos` (WAT), so the UI should display times in that zone too.
- Pagination comes in two shapes:
  - `Page<T>`: `{items, total, page, page_size}` for students, admins and elections.
  - `CursorPage<T>`: `{items, next_cursor}` for audit logs and messages. Pass `before=<next_cursor>` to get the next page.

### 1.2 Endpoints by role

**Auth (public)**
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/staff/login` | `{email, password}` | `TokenOut` (`onboarding_required: "change_password"` for new admins) |
| GET | `/auth/staff/me` | — | `StaffOut` (works during onboarding) |
| POST | `/auth/student/lookup` | `{identifier}` | `{identifier, id_type, full_name, level}` · `404 STUDENT_NOT_FOUND` · `409 ALREADY_REGISTERED` |
| POST | `/auth/student/register` | `{identifier, password, confirm_password}` | `201 {code:"REGISTERED", message}` (does **not** log in) |
| POST | `/auth/student/login` | `{identifier, password}` | `TokenOut` (`onboarding_required: "profile_picture"` until uploaded) |
| POST | `/auth/refresh` | `{refresh_token}` | `TokenOut` |
| POST | `/auth/logout` | `{refresh_token}` | `{code:"LOGGED_OUT"}` |

**Student** (all routes except `/students/me` and the picture upload return `403 PROFILE_PICTURE_REQUIRED` until a picture exists)
| Method | Path | Notes |
|---|---|---|
| GET | `/students/me` | `StudentProfileOut` |
| PUT | `/students/me/profile-picture` | multipart `image` (JPEG/PNG/WebP, ≤ 5 MB). Limited to 10 per hour. |
| GET | `/students/me/dashboard` | `DashboardOut`: `state ∈ no_election \| upcoming \| ongoing \| voted \| ended` |
| GET | `/elections/active` | `ElectionOut \| null` (not needed: the dashboard already embeds the election) |
| POST | `/elections/{id}/vote` | `{selections:[{position_id, candidate_id}]}`, one per position. `201 {code:"VOTE_RECORDED", message, cast_at}` |
| GET | `/elections/{id}/results` | `TallyOut`, only once ended; otherwise `403 RESULTS_NOT_AVAILABLE` |

**Admin** (`ONBOARDING_REQUIRED` until onboarding is done; read routes marked *staff* also accept the super admin)
| Method | Path | Notes |
|---|---|---|
| POST | `/admin/onboarding` | `{full_name, current_password, new_password, confirm_password}` → **new** `TokenOut` (old tokens revoked) |
| POST | `/admin/students` | `{identifier, full_name, level}` · `409 STUDENT_EXISTS` |
| POST | `/admin/students/bulk` | multipart `file` (CSV `identifier,full_name,level`, ≤ 2 MB, UTF-8, ≤ 20k rows) → `{created, skipped[], errors[]}` |
| GET | `/admin/students` *(staff)* | `page, page_size≤200, level, is_registered, search` |
| PATCH | `/admin/students/{id}` | `{full_name?, level?}` |
| DELETE | `/admin/students/{id}` | `409 STUDENT_HAS_VOTED` |
| POST | `/admin/students/{id}/reset-registration` | for forgotten passwords: the student registers again |
| GET | `/admin/elections` *(staff)* | `status ∈ draft\|published\|stopped`, `page, page_size≤100` |
| POST | `/admin/elections` | `{title, description?, start_time, end_time}` (timezone-aware ISO) |
| GET | `/admin/elections/{id}` *(staff)* | `ElectionOut` |
| PATCH | `/admin/elections/{id}` | partial update; `403 ELECTION_LOCKED` once started |
| DELETE | `/admin/elections/{id}` | drafts only; `409 NOT_A_DRAFT` |
| POST/PATCH/DELETE | `/admin/elections/{id}/positions[/{pid}]` | `{name}`; `409 POSITION_EXISTS`; max 30 positions |
| POST | `/admin/elections/{id}/positions/{pid}/candidates` | multipart `full_name` + `image`; max 30 per position |
| DELETE | `/admin/elections/{id}/positions/{pid}/candidates/{cid}` | |
| POST | `/admin/elections/{id}/publish` | `422 ELECTION_INCOMPLETE` (`details` = list of problems), `409 ELECTION_ALREADY_ACTIVE`, `409 BUSY` |
| POST | `/admin/elections/{id}/unpublish` | upcoming only; otherwise `403 ELECTION_LOCKED` |
| GET | `/admin/elections/{id}/tally` *(staff)* | `TallyOut` from MongoDB (authoritative) |
| GET | `/live/elections/{id}/stream` *(staff)* | **SSE**: events `tally` (≤ 1/s), `ended` (final `TallyOut`, then the stream closes), `error`; ping every 15 s |
| GET | `/admin/messages` | `before, limit, unread_only` → `CursorPage<InboxMessageOut>` |
| GET | `/admin/messages/unread-count` | `{unread}` |
| POST | `/admin/messages/{id}/read` | |

**Super admin**
| Method | Path | Notes |
|---|---|---|
| POST | `/super-admin/admins` | `{email}` → `{admin, temporary_password}` (**shown once**) · `409 EMAIL_EXISTS` |
| GET | `/super-admin/admins` | `status ∈ active\|suspended`, paginated |
| POST | `/super-admin/admins/{id}/suspend` · `/unsuspend` | `409 ALREADY_SUSPENDED` / `NOT_SUSPENDED` |
| POST | `/super-admin/admins/{id}/reset-password` | → `{admin, temporary_password}` (shown once) |
| DELETE | `/super-admin/admins/{id}` | soft delete |
| GET | `/super-admin/audit-logs` | `actor_id, action, date_from, date_to, before, limit≤200` |
| GET | `/super-admin/students` | same filters as the admin list |
| POST | `/super-admin/elections/{id}/stop` | `{reason}` (3–500 characters); `409 ELECTION_NOT_ONGOING` |
| POST | `/super-admin/messages` | `{to_all \| recipient_ids[], subject, body}` · `422 INVALID_RECIPIENTS` |
| GET | `/super-admin/messages` | sent messages with `read_by` receipts |

The super admin **cannot** create or edit elections. Those routes are admin-only. They view elections through the *staff* read routes, and stop them.

### 1.3 Business rules the UI must reflect
- **Identifier format:** Matric `^\d{9}$`, or Reg `^\d{12}[A-Za-z]{2}$`, upper-cased. Spaces are stripped.
- **Password policy:** 8–128 characters, with at least one letter and one digit.
- **Password changes:** only an admin changes their password, and only once, at first login (onboarding). Students and the super admin have no password change or reset. A student who forgets their password asks an admin, who uses `reset-registration` so the student can register again.
- **Election state** (`ElectionOut.state`): `draft | upcoming | ongoing | ended` (a stopped election is `ended`).

  | UI action | draft | upcoming | ongoing | ended |
  |---|---|---|---|---|
  | Edit details / positions / candidates (admin) | ✅ | ✅ | ❌ | ❌ |
  | Publish (admin) | ✅ | — | — | — |
  | Unpublish (admin) | — | ✅ | ❌ | ❌ |
  | Delete (admin) | ✅ | ❌ | ❌ | ❌ |
  | Stop (super admin) | — | — | ✅ | — |
- Only **one** published, un-ended election can exist at a time.
- Students see results only after an election ends, and only for 30 days (`results_visible_days`). After that the dashboard goes back to `no_election`.
- Rate limits the UI will hit: lookup 30/min per IP, register 20/min per IP, login 5/min per identifier with a 15-minute lockout after 10 failures (`429 ACCOUNT_LOCKED`), vote 5/min, general API 120/min per user. On `429`, read the `Retry-After` header.

---

## 2. Architecture

### 2.1 Decision: Backend-for-Frontend (BFF) through Next Route Handlers

The browser talks only to the Next app. Next Route Handlers forward requests to FastAPI and attach the bearer token from **httpOnly cookies**.

```
Browser ──same-origin──► Next.js
                          ├─ /api/session/{login,refresh,logout,onboarding}  (sets/clears cookies)
                          ├─ /api/v1/[...path]   (generic pass-through, adds Authorization)
                          └─ /api/v1/live/.../stream  (SSE pass-through)
                                   │
                                   ▼
                          FastAPI  ${API_URL}/api/v1/...
```

Why:
- Tokens never reach JavaScript, so an XSS bug can't steal them. The refresh token is kept out of `localStorage`.
- **The SSE token stays out of URLs.** The backend accepts `?token=` because `EventSource` can't send headers. The BFF calls upstream with an `Authorization` header instead.
- Same origin, so no CORS preflights in the browser.

Trade-off: there is one extra hop per request. The BFF must also forward the real client IP, because otherwise every student would share the Next server's IP and hit the per-IP limits (see §2.3).

### 2.2 Cookies
| Cookie | httpOnly | Contents | Purpose |
|---|---|---|---|
| `at` | yes | access token | attached by the BFF |
| `rt` | yes, `Path=/api/session` | refresh token | only sent to the session routes |
| `sess` | **no** | `{role, onboarding, exp}` (JSON, base64), no secrets | lets `proxy.ts` and client code make optimistic redirects and decide when to refresh |

All cookies are `Secure` (in production), `SameSite=Lax`, with `Max-Age` matching the token lifetimes (`expires_in` for `at`, 7 days for `rt`).

### 2.3 Real client IP and rate limits
- The BFF forwards `X-Forwarded-For: <client-ip>` (taken from the hosting platform's trusted header) and `User-Agent`. The backend records `User-Agent` in audit logs.
- Set the backend's `TRUSTED_PROXY_COUNT` to the number of proxies **including the BFF**. Example: Browser → platform LB → Next → backend LB → FastAPI gives `TRUSTED_PROXY_COUNT=2`. Verify this on staging by checking the `ip` field in audit logs.

### 2.4 Data fetching
- **Client-side with TanStack Query** for all authenticated data, through `/api/v1/...`. This is because:
  - Access tokens expire every 15 minutes, and Server Components can't set cookies to refresh them mid-render.
  - Most screens are interactive (forms, live tallies, polling).
- Server Components render the static shells (layouts, navigation, headings), which `cacheComponents` prerenders. Session-dependent parts sit inside `<Suspense>`.
- `proxy.ts` only does **optimistic** routing based on the `sess` cookie. The backend remains the real authority: every 401/403 is handled client-side.

### 2.5 Dependencies to add
```
bun add @tanstack/react-query react-hook-form zod @hookform/resolvers sonner clsx
bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```
Tailwind 4 is already configured. No chart library is needed: live tallies are horizontal CSS bars. Date formatting uses `Intl.DateTimeFormat` with `timeZone: "Africa/Lagos"`.

### 2.6 Environment
```
# .env.local
API_URL=http://localhost:8000          # server-only; never NEXT_PUBLIC_
NEXT_PUBLIC_DISPLAY_TZ=Africa/Lagos
```

---

## 3. Core frontend infrastructure

### 3.1 Folder structure
```
app/
├── (public)/
│   ├── page.tsx                       # landing: "I'm a student" / "Staff login"
│   ├── login/page.tsx                 # student login
│   ├── register/page.tsx              # student registration with live lookup
│   └── staff/login/page.tsx           # admin + super admin login
├── student/
│   ├── layout.tsx                     # shell + nav (profile, logout)
│   ├── onboarding/page.tsx            # compulsory profile picture
│   ├── page.tsx                       # dashboard (5 states)
│   └── profile/page.tsx
├── admin/
│   ├── layout.tsx                     # sidebar + unread badge
│   ├── onboarding/page.tsx            # full name + change password
│   ├── page.tsx                       # overview: current election card, student counts, unread msgs
│   ├── students/page.tsx              # list/search/filter/add/edit/delete/reset
│   ├── students/import/page.tsx       # CSV import + result report
│   ├── elections/page.tsx             # list with state badges
│   ├── elections/new/page.tsx
│   ├── elections/[id]/page.tsx        # builder: details, positions, candidates, publish/unpublish/delete
│   ├── elections/[id]/live/page.tsx   # SSE live tally (+ DB tally refresh)
│   └── messages/page.tsx              # inbox
├── super-admin/
│   ├── layout.tsx
│   ├── page.tsx                       # overview
│   ├── admins/page.tsx                # create (show temp password once), suspend/unsuspend/reset/delete
│   ├── audit-logs/page.tsx            # filters + infinite scroll
│   ├── students/page.tsx              # read-only list
│   ├── elections/page.tsx             # read-only list
│   ├── elections/[id]/page.tsx        # live view + "Stop election" (ongoing only)
│   └── messages/page.tsx              # compose + sent with read receipts
├── api/
│   ├── session/login/route.ts         # POST {kind:"staff"|"student", ...} → backend login → set cookies
│   ├── session/refresh/route.ts       # POST → backend refresh (rt cookie) → rotate cookies
│   ├── session/logout/route.ts        # POST → backend logout → clear cookies
│   ├── session/onboarding/route.ts    # POST → /admin/onboarding → replace cookies with new tokens
│   └── v1/[...path]/route.ts          # generic pass-through (GET/POST/PUT/PATCH/DELETE, JSON + multipart + SSE)
├── layout.tsx                         # QueryClientProvider, Toaster, fonts, metadata
└── globals.css
lib/
├── api/client.ts                      # apiFetch(): error parsing, 401 → single-flight refresh → retry
├── api/types.ts                       # TS mirror of backend schemas (§3.5)
├── api/errors.ts                      # ApiError class + code → UX mapping (§3.4)
├── api/hooks/*.ts                     # useDashboard, useStudents, useElection, useLiveTally, ...
├── server/backend.ts                  # server-only: forward to API_URL, build headers, set/clear cookies
├── session.ts                         # read/parse the `sess` cookie (client + server)
├── validation.ts                      # zod schemas: identifier, password, election form, etc.
└── time.ts                            # formatWAT(), toAwareISO(datetime-local) helpers
components/                            # Button, Input, Dialog, Table, Pagination, StateBadge, CandidateCard,
                                       # TallyBars, ImagePicker, ConfirmDialog, EmptyState, ErrorBanner
proxy.ts                               # optimistic role/onboarding redirects (exclude /api, /_next, static)
```

### 3.2 BFF pass-through (`app/api/v1/[...path]/route.ts`)
- Build the upstream URL as `${API_URL}/api/v1/${path}${search}`. Allowlist the first segment to `auth|students|elections|admin|super-admin|live`. Block `auth/refresh`, `auth/logout` and the login routes here, because they belong to `/api/session/*`.
- Attach `Authorization: Bearer <at>` if the `at` cookie exists. Forward `Content-Type` (keep the multipart boundary), `X-Forwarded-For`, `User-Agent` and `X-Request-ID`.
- Stream the request body (`body: req.body, duplex: "half"`) so multipart uploads aren't buffered. Keep `/api` **out of the `proxy.ts` matcher**, so `proxyClientMaxBodySize` buffering doesn't apply.
- Stream the response body back unchanged with its status code and `Content-Type`/`Retry-After` headers. For SSE (`text/event-stream`), also set `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`, and abort the upstream fetch when `req.signal` aborts (client disconnects).
- If the access cookie is missing or expired, still forward the request. The backend returns `401 NOT_AUTHENTICATED`/`TOKEN_EXPIRED`, and the client refresh flow handles it.
- Hosting note: serverless platforms cap function duration. Set `maxDuration` on the route if the platform supports it. In any case, the live page reconnects when the stream drops (§5.4).

### 3.3 Client fetch wrapper and the refresh flow (critical)
`apiFetch(path, init)`:
1. Calls `/api/v1/${path}`.
2. On `401` with code `TOKEN_EXPIRED`, `NOT_AUTHENTICATED` (when the `sess` cookie exists) or `INVALID_TOKEN`:
   - It runs `refreshSession()` under **`navigator.locks.request("vote-refresh", …)`**. That lock is shared across tabs, so only one refresh runs at a time.
   - Inside the lock, it re-reads the `sess` cookie. If `exp` has already moved forward (another tab refreshed), it skips the refresh.
   - Otherwise it calls `POST /api/session/refresh`, then retries the original request **once**.
3. If the refresh fails, or the error is `TOKEN_REVOKED` or `ACCOUNT_SUSPENDED`, it clears the session (`/api/session/logout`, best effort) and redirects to the right login page with a toast showing `message`.
4. It parses error bodies into `ApiError {status, code, message, details, retryAfter}`.

It also refreshes proactively: about 60 s before `sess.exp`, it runs the same locked refresh (only while the tab is visible). This keeps live-stream reconnects and vote submissions from hitting an expired token.

### 3.4 Error code → UX map (`lib/api/errors.ts`)
| Code | UX |
|---|---|
| `VALIDATION_ERROR` | Inline under the field when `details[].loc` names it; otherwise a banner with `message` |
| `INVALID_CREDENTIALS` | Form error "Invalid login details." |
| `ACCOUNT_LOCKED`, `RATE_LIMITED` | Banner with a countdown from `Retry-After`; disable submit |
| `ONBOARDING_REQUIRED` | Redirect to `/admin/onboarding` |
| `PROFILE_PICTURE_REQUIRED` | Redirect to `/student/onboarding` |
| `TOKEN_EXPIRED` / `INVALID_TOKEN` | Refresh and retry (§3.3) |
| `TOKEN_REVOKED`, `ACCOUNT_SUSPENDED` | Log out, redirect to login, toast `message` |
| `FORBIDDEN` | "You don't have access" page |
| `STUDENT_NOT_FOUND` | Inline under the identifier: the backend's "contact the admin" message |
| `ALREADY_REGISTERED` | Inline, with a link to `/login` |
| `ALREADY_VOTED` | Switch the dashboard to the `voted` state |
| `VOTING_NOT_STARTED` / `VOTING_ENDED` | Refetch the dashboard |
| `INCOMPLETE_BALLOT` / `INVALID_BALLOT` | Highlight `details.missing_positions`; refetch the election |
| `ELECTION_LOCKED` | Toast, then refetch the election (it has started) |
| `ELECTION_INCOMPLETE` | List every item in `details` in a publish checklist |
| `ELECTION_ALREADY_ACTIVE`, `BUSY`, `NOT_A_DRAFT`, `ELECTION_NOT_ONGOING`, `STUDENT_HAS_VOTED`, `STUDENT_EXISTS`, `EMAIL_EXISTS`, `POSITION_EXISTS` | Toast with `message` |
| `IMAGE_TOO_LARGE`, `INVALID_IMAGE`, `UPLOADS_UNAVAILABLE`, `UPLOAD_FAILED` | Inline under the image picker |
| `INTERNAL_ERROR`, network failure | Generic banner with a retry button; log the `X-Request-ID` response header |

### 3.5 Types (`lib/api/types.ts`), mirroring `voting-BD/app/models/schemas.py`
```ts
export type Role = "student" | "admin" | "super_admin";
export type Onboarding = "profile_picture" | "change_password" | null;
export interface TokenOut { access_token: string; refresh_token: string; token_type: "bearer"; expires_in: number; role: Role; onboarding_required: Onboarding }
export interface ApiErrorBody { code: string; message: string; details?: unknown }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface CursorPage<T> { items: T[]; next_cursor: string | null }

export interface StaffOut { id: string; email: string; full_name: string | null; role: Role; status: "active" | "suspended"; must_change_password: boolean; created_at: string; last_login_at: string | null }
export interface AdminCreatedOut { admin: StaffOut; temporary_password: string }
export interface StudentLookupOut { identifier: string; id_type: "matric" | "reg"; full_name: string; level: string }
export interface StudentOut { id: string; identifier: string; id_type: "matric" | "reg"; full_name: string; level: string; is_registered: boolean; profile_picture_url: string | null; created_at: string; registered_at: string | null }
export interface StudentProfileOut { id: string; identifier: string; id_type: "matric" | "reg"; full_name: string; level: string; profile_picture_url: string | null; onboarding_required: "profile_picture" | null }
export interface BulkImportOut { created: number; skipped: { line: number; identifier: string; reason: string }[]; errors: { line: number; identifier: string; error: string }[] }

export type ElectionState = "draft" | "upcoming" | "ongoing" | "ended";
export interface CandidateOut { id: string; full_name: string; image_url: string | null }
export interface PositionOut { id: string; name: string; candidates: CandidateOut[] }
export interface ElectionOut { id: string; title: string; description: string | null; status: "draft" | "published" | "stopped"; state: ElectionState; start_time: string; end_time: string; stopped_at: string | null; stop_reason: string | null; published_at: string | null; positions: PositionOut[]; created_at: string }

export interface CandidateResult extends CandidateOut { votes: number; percentage: number }
export interface PositionResult { id: string; name: string; candidates: CandidateResult[]; winner_ids: string[] }
export interface TallyOut { election_id: string; title: string; state: ElectionState; total_votes: number; eligible_voters: number; registered_voters: number; turnout_percentage: number; positions: PositionResult[]; updated_at: string; source: "live" | "database" }

export type DashboardState = "no_election" | "upcoming" | "ongoing" | "voted" | "ended";
export interface DashboardOut { state: DashboardState; message: string; election: ElectionOut | null; starts_at: string | null; ends_at: string | null; results: TallyOut | null }

export interface InboxMessageOut { id: string; subject: string; body: string; sender_id: string; read: boolean; created_at: string }
export interface SentMessageOut { id: string; subject: string; body: string; recipient_ids: string[]; read_by: { user_id: string; read_at: string }[]; created_at: string }
export interface AuditLogOut { id: string; actor_id: string | null; actor_email: string | null; actor_role: Role | null; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; ip: string | null; created_at: string }
```
Note: `TallyOut.positions[].candidates` is already **sorted by votes, highest first**, and `winner_ids` can hold several IDs when there is a tie.

### 3.6 `proxy.ts` (optimistic routing only)
Matcher: everything except `/api`, `/_next`, and static files. Using the `sess` cookie:
- No session on `/student/*`: redirect to `/login`. No session on `/admin/*` or `/super-admin/*`: redirect to `/staff/login`.
- Role mismatch: redirect to that role's home.
- `onboarding === "profile_picture"`: allow only `/student/onboarding`. `onboarding === "change_password"`: allow only `/admin/onboarding`.
- Signed-in user on a login or register page: redirect to their home.

---

## 4. Screens

### 4.1 Public
**Landing `/`**: two cards: Student (Login / Register) and Staff login.

**Register `/register`** (the main student-facing form)
1. Identifier input: trimmed and upper-cased on blur. A hint below it shows both formats.
2. When the value matches the regex (client-side zod), debounce for 400 ms and call `POST /api/v1/auth/student/lookup`. Cancel stale requests with `AbortController`.
   - 200: show a confirmation card with **Full name** and **Level** ("Is this you?"), then reveal the password fields.
   - `404 STUDENT_NOT_FOUND`: red inline message showing the backend text.
   - `409 ALREADY_REGISTERED`: inline message with a "Go to login" link.
   - `429`: "Too many lookups, try again in Ns."
3. Password and Confirm password fields, with a live policy checklist (8+ characters, a letter, a number) and a match check.
4. On submit, call `POST /auth/student/register`. On `201`, toast `message` and redirect to `/login?identifier=…`.

**Student login `/login`**: identifier and password, sent to `POST /api/session/login {kind:"student"}`. On success, go to `/student/onboarding` if `onboarding_required === "profile_picture"`, otherwise `/student`. Below the form, show "Forgot your password? Contact your admin." There is no reset link.

**Staff login `/staff/login`**: email and password, with `kind:"staff"`. Route by `role` and `onboarding_required`: `/admin/onboarding`, `/admin` or `/super-admin`.

### 4.2 Student
**Onboarding `/student/onboarding`**: explains that a profile picture is compulsory. The image picker validates type and size (≤ 5 MB, JPEG/PNG/WebP) and shows a circular preview. It uploads with `PUT /students/me/profile-picture` (FormData field `image`). On success, `/api/session/refresh` updates the `sess.onboarding` cookie, then the user is sent to `/student`. The page has no other navigation except Logout.

**Dashboard `/student`**: a `useDashboard()` query that switches on `state`:
| State | UI |
|---|---|
| `no_election` | Empty state showing `message` ("Voting is not ongoing. Please check back later.") |
| `upcoming` | `message` plus a live countdown to `starts_at`, and a read-only preview of positions and candidates |
| `ongoing` | **Ballot**: one section per position with a candidate card grid (photo, name), choose exactly one (radio semantics). A sticky footer shows "N of M positions chosen". A **review dialog** lists the choices, then "Submit vote" calls `POST /elections/{id}/vote`. The submit button is disabled while the request is in flight, to prevent double submission. Also show "Closes on {ends_at}". |
| `voted` | Success panel showing `message` ("Your votes have already been recorded…") |
| `ended` | Results: per position, candidates with photos, vote counts, percentage bars and a "Winner" badge (handle ties), plus total votes and turnout |

Refetch strategy (designed for 2,000 simultaneous voters):
- Refetch on window focus. Poll every 60 s while `upcoming` or `ongoing`. No polling for `voted`, `ended` or `no_election`, except on focus.
- **Boundary refetch:** schedule a refetch at `starts_at` (and at `ends_at`) plus a **random 0–10 s jitter**, so 2,000 clients don't hit the API in the same second. The backend caches the current election for 30 s, so a few seconds of staleness is expected. Show "Opening…" until the state flips.
- After a successful vote, set the query data to the `voted` state immediately (no extra round trip).
- Keep the ballot selection in `sessionStorage` (keyed by election ID), so an accidental refresh doesn't lose it.

**Profile `/student/profile`**: photo, full name, Matric/Reg number (labelled by `id_type`), level, and a "Change picture" button that reuses the picker.

### 4.3 Admin
**Onboarding `/admin/onboarding`**: full name, current (temporary) password, new password and confirm. Client-side, check the policy, the match, and that the new password differs from the temporary one. The form posts to `/api/session/onboarding`, which calls `/admin/onboarding` and **replaces the cookies with the returned tokens**, because the old tokens are revoked. Then go to `/admin`.

**Overview `/admin`**: the current or most recent election card (state badge, times, link to the builder or live view), student counts (total and registered, via `GET /admin/students?page_size=1` with and without `is_registered=true`, using `total`), and the unread-messages count.

**Students `/admin/students`**
- Table: name, identifier, type, level, registered (badge), profile picture thumbnail, date added.
- Search (debounced, matches name or identifier), level filter, registered filter, pagination (`page_size` 50). Keep filters in the URL search params.
- "Add student" dialog with an identifier, full name and level, validated with the shared zod schema.
- Row actions: Edit (name and level), Reset registration (confirm: "The student will need to register again"), Delete (confirm; surfaces `STUDENT_HAS_VOTED`).

**Import `/admin/students/import`**: drag-and-drop CSV (≤ 2 MB), a downloadable template generated client-side (`identifier,full_name,level`), and a client-side preview of the first 10 rows. After upload, show a result report: created count, plus **skipped** and **errors** tables (line, identifier, reason). Offer to download the errors as a CSV.

**Elections list `/admin/elections`**: table with title, state badge, start and end (WAT), and the number of positions. Filter by `status`. A "New election" button.

**New election `/admin/elections/new`**: title, description, start and end (`datetime-local`, read **as WAT** and converted to an aware ISO string with `+01:00`; label the inputs "(WAT)"). Validate start < end and end in the future. On create, go to the builder.

**Builder `/admin/elections/[id]`**
- Header: title, state badge, times, and a lock banner when `state ∈ {ongoing, ended}`: "Voting has started. Only the super admin can stop it."
- Details form (PATCH, only sends changed fields). Disabled when locked.
- Positions: add, rename inline, delete with confirmation, each with a candidate list. Add a candidate with a full name and photo (multipart), and remove candidates. Each mutation returns the full `ElectionOut`, so write it straight into the query cache.
- **Publish checklist** (computed client-side, mirroring the backend): at least one position, every position has at least one candidate, and the end time is in the future. Then the Publish button. Show `details` from `ELECTION_INCOMPLETE` if the server disagrees.
- Unpublish (upcoming only) and Delete (draft only), each with a confirmation.
- When `state === "upcoming"`, show a countdown and warn that editing locks at the start time. When the countdown reaches zero, refetch.
- A "Live view" link when ongoing or ended.

**Live `/admin/elections/[id]/live`** (shared with the super admin, see §5.4): big numbers (total votes, turnout %, registered vs eligible), per-position bars updating in real time, a "Last updated" time, a connection status dot, and a "Refresh from database" button (`GET /tally`, the authoritative count). When the `ended` event arrives, show "Final results".

**Messages `/admin/messages`**: an inbox list (unread in bold) with infinite scroll on `next_cursor` and an "Unread only" toggle. Opening a message calls `POST /{id}/read` and updates the cache optimistically. The unread badge in the sidebar polls `unread-count` every 60 s and on focus. The sender is always the super admin, so label it "Super admin".

### 4.4 Super admin
**Admins `/super-admin/admins`**
- Table: email, name (or "Pending setup" when `must_change_password`), status, last login, created. Filter by status.
- "Add admin" (email) opens a **one-time password dialog** showing `temporary_password`, with a Copy button and a warning: "This password will not be shown again. Share it securely." The dialog can only be closed through an explicit "I've copied it" button.
- Row actions: Suspend/Unsuspend, Reset password (same one-time dialog), Delete (confirm; "their activity log is kept").

**Audit logs `/super-admin/audit-logs`**: filters for admin (a dropdown fed by the admin list, sent as `actor_id`), action (a dropdown of known actions: `auth.login`, `auth.login_failed`, `admin.onboarded`, `admin.create|suspend|unsuspend|reset_password|delete`, `student.create|bulk_import|update|delete|reset_registration`, `election.create|update|delete|publish|unpublish|stop`, `position.add|rename|remove`, `candidate.add|remove`, `message.send`) and a date range (`date_from`/`date_to` as aware ISO). Infinite scroll. Each row shows the time, actor email and role, action, target, IP and an expandable metadata JSON view.

**Students `/super-admin/students`**: the same table component as the admin page, read-only (no action column).

**Elections `/super-admin/elections`** and **`/super-admin/elections/[id]`**: read-only election details, plus the shared live view. When `state === "ongoing"`, a red **Stop election** button opens a dialog that requires a reason (3–500 characters) and typing the election title to confirm. It calls `POST /super-admin/elections/{id}/stop`. Afterwards the stream emits `ended` and the page shows the final results and the stop reason.

**Messages `/super-admin/messages`**: a compose form with recipients (an "All admins" toggle or a multi-select fed by the admin list), subject (≤ 200 characters) and body (≤ 10,000 characters). The sent list shows read receipts as "Read by X of Y", and expands to show admin emails and read times by mapping `user_id`s through the admin list.

---

## 5. Cross-cutting concerns

### 5.1 Time handling (`lib/time.ts`)
- `formatWAT(iso)` uses `Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })` and appends "WAT".
- `toAwareISO(localValue)` treats `datetime-local` input as WAT (fixed `+01:00`; Nigeria has no daylight saving time) and returns `YYYY-MM-DDTHH:mm:00+01:00`. The backend rejects timezone-naive datetimes.
- Countdowns use the **server's** notion of time where possible. Compute the skew once from the `Date` response header and apply it to client countdowns.

### 5.2 Forms
react-hook-form + zod. Share these schemas from `lib/validation.ts`: `identifier`, `password`, `studentCreate`, `electionForm`, `messageForm`, `stopReason`. Client-side validation mirrors the backend. Server errors still come through `ApiError` and are mapped onto fields when possible.

### 5.3 Images
Candidate and profile images are Cloudinary URLs that the backend has already cropped to 400×400. Add `res.cloudinary.com` to `images.remotePatterns` in `next.config.ts` and use `next/image`. Fall back to an initials avatar when `image_url` is null.

### 5.4 Live tally hook (`useLiveTally(electionId)`)
- `new EventSource("/api/v1/live/elections/{id}/stream")` is same-origin, and the cookie authenticates it through the BFF, so no `?token=` is needed.
- Listen for `tally` (replace state), `ended` (set final results, call `close()`, stop reconnecting) and `error` (show "Reconnecting…").
- `EventSource` reconnects on its own, but a 401 surfaces as a generic error. On `onerror`, close the stream, run the locked refresh (§3.3), then reopen with backoff (1 s, 2 s, 5 s, capped at 15 s).
- Fallback: if the stream fails three times in a row, poll `GET /admin/elections/{id}/tally` every 5 s and show a "Live updates unavailable, polling" banner.
- Close the stream when the tab is hidden for more than 60 s, and reopen it when the tab becomes visible.

### 5.5 Accessibility and responsiveness
- Students will mostly use phones, so design the ballot mobile-first. Candidate cards need large tap targets.
- The ballot uses a `fieldset`/`legend` per position with real radio inputs (styled as cards), so it works with the keyboard and screen readers.
- Live regions: announce the vote result, and use `aria-live="polite"` on the live tally totals.
- Dark mode: the existing Tailwind setup supports it. Define colour tokens once in `globals.css`.

### 5.6 Security on the frontend
- Never expose `API_URL` or tokens to the client. Keep `server-only` imports in `lib/server/*`.
- CSRF: cookies are `SameSite=Lax`, and every state-changing BFF route requires a `Content-Type: application/json` or `multipart/form-data` request plus a matching `Origin` header (reject cross-origin `Origin`).
- Security headers in `next.config.ts` `headers()`: CSP (allow `img-src` for `res.cloudinary.com`), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- Never log tokens. The temporary admin password lives only in component state and is cleared when the dialog closes.

---

## 6. Implementation phases

### Phase 0 — Setup (½ day)
- [ ] Read the Next 16 docs listed at the top. Install the dependencies (§2.5).
- [ ] Replace the starter `app/page.tsx` and `layout.tsx` metadata (title "Campus Voting").
- [ ] `.env.local` with `API_URL`. Run the backend locally (`docker compose up redis mongo`, `uvicorn app.main:app --reload`) and create a super admin with `python -m scripts.create_super_admin`.
- [ ] `next.config.ts`: `images.remotePatterns` for Cloudinary, security `headers()`.
- [ ] Base UI components and design tokens.

### Phase 1 — BFF and session (1½ days)
- [ ] `lib/server/backend.ts` (forwarding, header building, cookie helpers).
- [ ] `/api/session/{login,refresh,logout,onboarding}` route handlers.
- [ ] `/api/v1/[...path]` pass-through: JSON, multipart streaming, SSE streaming, path allowlist, Origin check.
- [ ] `lib/api/client.ts` with the locked single-flight refresh and proactive refresh. `ApiError` and the code map.
- [ ] `proxy.ts` with optimistic redirects.
- [ ] Vitest: error parsing, refresh single-flight (two concurrent 401s cause exactly one refresh call).

### Phase 2 — Student flows (2 days)
- [ ] Register with live lookup, and student login.
- [ ] Profile picture onboarding, and the profile page.
- [ ] Dashboard with all 5 states, the ballot with review and submit, results view, countdown with jittered boundary refetch.

### Phase 3 — Admin: onboarding and students (1½ days)
- [ ] Staff login and admin onboarding (token replacement).
- [ ] Admin layout with unread badge, and the overview.
- [ ] Students table (search/filter/paginate/add/edit/delete/reset) and CSV import with report.

### Phase 4 — Admin: elections (2 days)
- [ ] Elections list, new election form (WAT ↔ ISO).
- [ ] Builder: details, positions, candidates with uploads, publish checklist, publish/unpublish/delete, lock banner.
- [ ] `useLiveTally` and the live page, with a DB refresh button and polling fallback.

### Phase 5 — Super admin (1½ days)
- [ ] Admin management with the one-time password dialog.
- [ ] Audit logs with filters and infinite scroll.
- [ ] Read-only students and elections, live view, stop dialog.
- [ ] Messaging: compose, and sent list with receipts. Admin inbox with mark-as-read.

### Phase 6 — Hardening and testing (2 days)
- [ ] Playwright end-to-end tests against the local backend (seed through the API in `globalSetup`):
  1. Super admin creates an admin, and the admin onboards with the temporary password.
  2. Admin adds students (single and CSV), creates an election, adds positions and candidates (fixture images), and publishes.
  3. An unknown identifier on the register page shows "contact the admin". A known one shows the name and level, then registers and logs in.
  4. The student is forced to upload a picture, then sees the `upcoming` state with a countdown.
  5. Once the start time passes (create the election with a start ~1 min ahead), the student votes. A reload shows `voted`, and a second submission is impossible.
  6. The super admin's live page shows the count rise, they stop the election, and the student sees results.
  7. A suspended admin's open tab is logged out on its next request.
  8. Two tabs open past the access-token expiry both stay logged in (refresh lock works).
- [ ] Rate-limit UX (lock out the login, check the countdown banner).
- [ ] Lighthouse/a11y pass on the register, ballot and results pages (mobile).
- [ ] Load check: 2,000 voters mostly hit the backend, but confirm the BFF adds little latency (run the backend's Locust scenario through the Next URL on staging).

### Phase 7 — Deployment (½ day)
- [ ] Deploy Next close to the API's region. Set `API_URL` and set backend `CORS_ORIGINS` to the frontend origin.
- [ ] Set backend `TRUSTED_PROXY_COUNT` to include the BFF hop (§2.3), and verify the IPs in audit logs.
- [ ] Confirm SSE isn't buffered or cut off by the host (duration limits). Make sure the reconnect path works.

**Estimate:** about 11–12 working days for one developer.

---

## 7. Backend findings and suggested follow-ups

These came out of the backend review. None of them block the frontend, which works around each one as noted.

| # | Finding | Impact | Suggestion |
|---|---|---|---|
| 1 | Refresh-token reuse revokes **all** sessions | Concurrent refreshes (multiple tabs or requests) log the user out | Frontend: locked single-flight refresh (§3.3). Backend (optional): a 10–30 s grace window during which a just-rotated token returns the same new pair |
| 2 | Per-IP rate limits key on `client_ip()` | Behind the BFF every user shares one IP unless XFF is forwarded and `TRUSTED_PROXY_COUNT` counts the BFF | Configure as in §2.3 |
| 3 | **By design:** the only password change in the system is the admin's compulsory change on first login (`/admin/onboarding`) | — | Build no "change password" or "forgot password" screens for any role. A super admin can issue an admin a new temporary password (`reset-password`), which sends that admin through onboarding again |
| 4 | **By design:** students and the super admin can't change or reset their own passwords | — | The student login page shows "Forgot your password? Contact your admin." (the admin can use `reset-registration`, after which the student registers again) |
| 5 | `InboxMessageOut` has only `sender_id` | — | Show "Super admin"; add `sender_name` later if more senders are introduced |
| 6 | Live stream accepts `?token=` (token in URL, may end up in logs) | Leak risk | The BFF uses a header instead, so the query token is never used. Backend could drop the query option once the BFF is live |
| 7 | No endpoint for student counts | The overview uses `GET /admin/students?page_size=1` and `total` | Fine for now; a `/admin/stats` endpoint would save two calls |
| 8 | `/elections/active` duplicates the dashboard's `election` | — | The frontend doesn't use it |
| 9 | The candidate upload limit is `rl_upload_per_user_hour * 10` (100/hour) and profile uploads are 10/hour | Large ballots built in one sitting could hit the limit | Show the `Retry-After` countdown |
| 10 | Results are hidden from students 30 days after an election ends | The dashboard goes back to `no_election` | Expected; documented in the UI copy |
