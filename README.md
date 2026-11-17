# Campus Voting — Frontend

The web app for student union elections. Admins add students and build ballots, students register
with their Matric or Registration number and vote once, and everyone sees the results when polls
close.

This repo is the **Next.js frontend**. The API lives in the sibling repo
[`voting-BD`](../voting-BD) (FastAPI · MongoDB · Redis · Cloudinary).

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [How it works](#how-it-works)
- [Pages](#pages)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Accessibility](#accessibility)

---

## Features

### Students

- Register with a Matric number (9 or 10 digits) or Registration number (12 digits + 2 letters).
  Their name and level appear as they type, so they can confirm it's them.
- A profile photo is required on first sign-in.
- The dashboard always shows where things stand:

  | State       | What the student sees                                                  |
  | ----------- | ---------------------------------------------------------------------- |
  | No election | An animated ballot box and a **Check again** button                    |
  | Scheduled   | A countdown to opening and a preview of the candidates                 |
  | Voting open | The ballot: one choice per position, then a review step before casting |
  | Voted       | An hourglass inside a ring that fills until polls close                |
  | Closed      | Results per position, with turnout and winners (ties are shown)        |

- Profile page with a voter card and the Light / Dark theme switch.

### Admins

- First login: set their full name and replace the temporary password.
- Students: add one at a time, import a CSV (with a per-row error report), search, edit, delete,
  and reset a registration when a student forgets their password.
- Elections: build a draft, add positions and candidates, then publish.
  - Candidate photos can be **zoomed and repositioned** before upload.
  - Candidates can be **edited** (name and/or photo) until voting opens.
  - A checklist shows what's missing before an election can be published.
- Live count during voting, final results afterwards.
- Inbox for messages from the super admin.

### Super admin

- Create admins (the temporary password is shown once), and suspend, unsuspend, reset or delete them.
- Activity log of every staff action, filterable by admin, action and date.
- Read-only view of all students and elections.
- Live view of any election, and **Stop election** while voting is open (requires a reason).
- Send messages to all admins or selected ones, with read receipts.

### Everywhere

- Light and dark mode. The first visit follows the device theme; a choice is remembered.
- The favicon switches between light and dark too.
- Small, purposeful motion that turns off completely with the OS "reduce motion" setting.
- All times are shown in West Africa Time (WAT).

---

## Tech stack

| Area      | Choice                                                                |
| --------- | --------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Cache Components, Turbopack)                  |
| UI        | React 19, Tailwind CSS 4, Plus Jakarta Sans + Geist Mono              |
| Data      | TanStack Query 5                                                      |
| Forms     | Controlled inputs + Zod 4 validation (mirrors the backend's rules)    |
| Toasts    | Sonner                                                                |
| Charts    | Hand-built SVG donuts and columns, colour-blind-checked palette       |
| Runtime   | Bun (package manager and scripts)                                     |

> **Next.js 16 differs from older versions.** Middleware is now `proxy.ts`, and with Cache
> Components any request data must be read inside `<Suspense>`. Read the guides in
> `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh) 1.4+ (Node.js 20+ also works)
- The backend running locally — see [`voting-BD/README.md`](../voting-BD/README.md)

### Run it

```bash
bun install
cp .env.example .env.local     # then set API_URL if the backend isn't on :8000
bun dev                        # http://localhost:3000
```

### First sign-in

1. Create the super admin in the backend repo:

   ```bash
   python -m scripts.create_super_admin --email you@school.edu --name "Your Name"
   ```

2. Sign in at `/staff/login`, then go to **Admins** and create an admin.
3. Sign in as that admin with the temporary password and finish account setup.
4. Add students, build an election and publish it.

---

## Environment variables

Set these in `.env.local` (development) or in your host's settings (production).

| Variable                 | Default                 | Purpose                                                                                 |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------- |
| `API_URL`                | `http://localhost:8000` | Backend base URL. **Server-only** — never prefix it with `NEXT_PUBLIC_`.                |
| `FRONT_PROXY_COUNT`      | `0`                     | Proxies in front of this app whose `X-Forwarded-For` is trusted. Use `1` on most hosts. |
| `REFRESH_TOKEN_DAYS`     | `7`                     | Lifetime of the refresh-token cookie. Must match the backend's `REFRESH_TOKEN_DAYS`.    |
| `NEXT_PUBLIC_DISPLAY_TZ` | `Africa/Lagos`          | Time zone used to display dates.                                                        |
| `COOKIE_SECURE`          | _(automatic)_           | `true` / `false` forces the cookie `Secure` flag. By default it's set only over HTTPS.  |

---

## Scripts

| Command         | What it does                               |
| --------------- | ------------------------------------------ |
| `bun dev`       | Development server with hot reload         |
| `bun run build` | Production build                           |
| `bun start`     | Serve the production build                 |
| `bun lint`      | ESLint (includes the React Compiler rules) |

Type-check with `bunx tsc --noEmit` (run `bunx next typegen` first on a fresh clone).

---

## How it works

### Backend-for-frontend

The browser only ever talks to this app. Route handlers forward requests to FastAPI and attach the
access token from an httpOnly cookie, so tokens are never readable by page JavaScript.

```text
Browser ──same origin──► Next.js
                          ├─ /api/session/{login,refresh,logout,onboarding}   sets / clears cookies
                          └─ /api/v1/[...path]                                 adds the bearer token,
                                   │                                           streams uploads + SSE
                                   ▼
                          FastAPI  ${API_URL}/api/v1/…
```

### Sessions

| Cookie | httpOnly | Contents                           | Used for                                   |
| ------ | -------- | ---------------------------------- | ------------------------------------------ |
| `at`   | yes      | Access token (15 min)              | Attached to API calls by the BFF           |
| `rt`   | yes      | Refresh token, path `/api/session` | Rotating the session                       |
| `sess` | no       | `{role, onboarding, exp}`          | Redirects in `proxy.ts` and refresh timing |

- The backend revokes **every** session if a refresh token is reused, so refreshes are serialised
  across tabs with the Web Locks API (`lib/api/client.ts`).
- Tokens are refreshed about a minute before they expire.
- `proxy.ts` only does optimistic redirects (wrong role, onboarding pending). The backend
  re-checks every request.

### Live results

The live count uses Server-Sent Events through the BFF, so the token stays out of the URL. If the
stream drops, it refreshes the session and reconnects with backoff, and falls back to polling after
three failures (`lib/api/use-live-tally.ts`).

### Peak load

At the moment voting opens or closes, each student's dashboard refetches after a random 0–10 second
delay, so 2,000 clients don't hit the API in the same second.

---

## Pages

| Path                          | Who         | Purpose                                   |
| ----------------------------- | ----------- | ----------------------------------------- |
| `/`                           | Everyone    | Landing page                              |
| `/register`                   | Students    | Registration with live name lookup        |
| `/login`                      | Students    | Student sign-in                           |
| `/staff/login`                | Staff       | Admin and super admin sign-in             |
| `/student`                    | Student     | Dashboard: ballot, waiting state, results |
| `/student/onboarding`         | Student     | Required profile photo                    |
| `/student/profile`            | Student     | Voter card and theme switch               |
| `/admin`                      | Admin       | Overview                                  |
| `/admin/onboarding`           | Admin       | First-login name and password             |
| `/admin/students`             | Admin       | Student list and management               |
| `/admin/students/import`      | Admin       | CSV import                                |
| `/admin/elections`            | Admin       | Election list                             |
| `/admin/elections/new`        | Admin       | Create a draft                            |
| `/admin/elections/[id]`       | Admin       | Election builder                          |
| `/admin/elections/[id]/live`  | Admin       | Live count and results                    |
| `/admin/messages`             | Admin       | Inbox                                     |
| `/super-admin`                | Super admin | Overview                                  |
| `/super-admin/admins`         | Super admin | Admin management                          |
| `/super-admin/elections`      | Super admin | Election list                             |
| `/super-admin/elections/[id]` | Super admin | Live view and **Stop election**           |
| `/super-admin/students`       | Super admin | Read-only student list                    |
| `/super-admin/audit-logs`     | Super admin | Activity log                              |
| `/super-admin/messages`       | Super admin | Compose messages and see read receipts    |

---

## Project structure

```text
app/
├── page.tsx                    Landing page
├── login/  register/  staff/   Public auth pages
├── student/                    Student dashboard, onboarding, profile
├── admin/
│   ├── onboarding/             First-login setup (outside the sidebar layout)
│   └── (console)/              Sidebar layout: overview, students, elections, messages
├── super-admin/                Admins, elections, students, activity log, messages
├── api/
│   ├── session/                Login, refresh, logout, onboarding (cookie handling)
│   └── v1/[...path]/           Pass-through to the backend (JSON, multipart, SSE)
├── icon.svg  apple-icon.tsx    Favicon (light + dark) and home-screen icon
└── template.tsx                Page-enter animation
components/
├── ui.tsx                      Buttons, fields, cards, dialogs, tables, badges
├── shell.tsx                   Staff sidebar, student top bar, auth layout
├── election.tsx                State badge, countdown, results, image picker
├── charts.tsx                  Donut and column charts
├── image-adjuster.tsx          Zoom / reposition photos before upload
├── theme.tsx                   Light / Dark switch and favicon sync
└── …                           Showcase cards, animations, icons
lib/
├── api/                        Fetch client, error codes, types, live-tally hook
├── server/backend.ts           Server-only BFF helpers (cookies, forwarding)
├── session.ts                  The non-secret `sess` cookie
├── time.ts                     WAT formatting and server-clock skew
└── validation.ts               Zod schemas shared by the forms
proxy.ts                        Optimistic role and onboarding redirects
public/icon-{light,dark}.svg    Favicon variants for the theme switch
```

---

## Deployment

1. Set `API_URL` to the backend's address (server-to-server; it doesn't need to be public).
2. Set `FRONT_PROXY_COUNT` (usually `1`) and, on the **backend**, count this app as one more hop
   in `TRUSTED_PROXY_COUNT`. Otherwise every student shares the app's IP and hits the backend's
   per-IP rate limits. Check the IPs in the activity log after deploying.
3. Add this app's origin to the backend's `CORS_ORIGINS`.
4. Make sure the host doesn't buffer Server-Sent Events or cut long requests short. The live count
   reconnects automatically, but buffering delays updates.
5. Build and start:

   ```bash
   bun install --frozen-lockfile
   bun run build
   bun start
   ```

Security headers, including a Content Security Policy that allows images and photo fetches only
from Cloudinary, are set in `next.config.ts`.

---

## Accessibility

- Every form field has a label; errors are announced and linked to their field.
- The ballot uses real radio groups, so it works with a keyboard and screen readers.
- Charts show a text label and value next to every colour, and the chart colours were checked for
  colour-blind separation in both themes.
- Dialogs move focus inside and close with <kbd>Esc</kbd>.
- The photo adjuster works with arrow keys (move) and <kbd>+</kbd> / <kbd>−</kbd> (zoom).
- With the OS "reduce motion" setting on, all animations stop.
