"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { ColumnChart, Donut } from "./charts";
import { IconCheck, IconClock, IconKey, IconMail, IconSearch } from "./icons";
import { Avatar } from "./ui";

export type ShowcaseKind = "student-login" | "staff-login" | "register" | "reset";

/** Decorative sample cards for the auth pages' left panel (static data, hidden from assistive tech). */
function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("surface p-5", className)}>{children}</div>;
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("surface flex items-center gap-3 !rounded-2xl px-4 py-3", className)}>{children}</div>;
}

// ---- student login: a half-filled ballot -------------------------------------------------------------

function BallotPreviewCard() {
  const rows = [
    { n: "Adaeze Okafor", picked: true },
    { n: "Tunde Bakare", picked: false },
    { n: "Fatima Sule", picked: false },
  ];
  return (
    <Card className="w-[290px]">
      <p className="text-xs font-semibold text-muted">Faculty Reps 2026</p>
      <p className="mt-1 text-lg font-extrabold tracking-tight">Your ballot</p>
      <p className="mt-4 flex items-baseline gap-2 text-sm font-bold">
        <span className="num text-xs font-medium text-muted">01</span> President
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.n}
            className={clsx(
              "flex items-center gap-3 rounded-2xl border-2 px-2.5 py-2 text-sm font-semibold",
              r.picked ? "border-primary bg-primary-soft" : "border-transparent bg-subtle",
            )}
          >
            <Avatar name={r.n} size={30} />
            <span className="flex-1">{r.n}</span>
            <span
              className={clsx(
                "flex size-5 items-center justify-center rounded-full",
                r.picked ? "bg-primary text-primary-fg" : "border-2 border-border-strong",
              )}
            >
              {r.picked && <IconCheck size={11} strokeWidth={3} />}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted">
            <span className="num font-bold text-foreground">1/3</span> chosen
          </p>
          <div className="mt-1.5 flex gap-1">
            <span className="h-1 flex-1 rounded-full bg-primary" />
            <span className="h-1 flex-1 rounded-full bg-border" />
            <span className="h-1 flex-1 rounded-full bg-border" />
          </div>
        </div>
        <span className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg">Review</span>
      </div>
    </Card>
  );
}

function OpensChip() {
  return (
    <Chip>
      <span className="flex size-9 items-center justify-center rounded-full bg-info-soft text-info">
        <IconClock size={17} />
      </span>
      <div>
        <p className="text-xs text-muted">Voting opens in</p>
        <p className="num text-base font-extrabold tracking-tight">02 : 14 : 30</p>
      </div>
    </Chip>
  );
}

// ---- staff login: live count + activity ------------------------------------------------------------

function LiveCountCard() {
  return (
    <Card className="w-[300px]">
      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold tracking-tight">Live count</p>
        <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Live
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-subtle px-3 py-2">
          <p className="text-[11px] text-muted">Ballots cast</p>
          <p className="num text-xl font-extrabold tracking-tight">1,284</p>
        </div>
        <div className="rounded-2xl bg-subtle px-3 py-2">
          <p className="text-[11px] text-muted">Turnout</p>
          <p className="num text-xl font-extrabold tracking-tight">64%</p>
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold">President · votes</p>
      <div className="mt-6">
        <ColumnChart
          height={110}
          label="Sample live votes per candidate"
          data={[
            { key: "a", label: "Adaeze", value: 512, color: "var(--series-1)" },
            { key: "b", label: "Tunde", value: 431, color: "var(--series-2)" },
            { key: "c", label: "Fatima", value: 341, color: "var(--series-3)" },
          ]}
        />
      </div>
    </Card>
  );
}

function ActivityChip() {
  const rows = [
    { a: "election.publish", t: "09:02" },
    { a: "student.bulk_import", t: "08:47" },
  ];
  return (
    <Chip className="!items-start">
      <Avatar name="Ada Admin" size={32} />
      <div className="min-w-0">
        <p className="text-xs font-bold">Ada Admin</p>
        <ul className="mt-1 flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.a} className="flex items-center gap-2 text-[11px] text-muted">
              <span className="rounded-full bg-primary-soft px-1.5 py-px font-semibold text-primary">{r.a}</span>
              <span className="num">{r.t}</span>
            </li>
          ))}
        </ul>
      </div>
    </Chip>
  );
}

// ---- register: the lookup + voter card -------------------------------------------------------------

function LookupCard() {
  return (
    <Card className="w-[290px]">
      <p className="text-lg font-extrabold tracking-tight">Find yourself</p>
      <p className="mt-1 text-xs text-muted">Matric / Registration number</p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <IconSearch size={15} className="text-muted" />
        <span className="num text-sm font-semibold tracking-wide">220703012</span>
        <span className="ml-auto h-4 w-px animate-pulse bg-primary" />
      </div>
      <div className="mt-3 rounded-2xl bg-primary-soft p-3">
        <p className="text-xs font-bold text-primary">Is this you?</p>
        <div className="mt-2 flex items-center gap-3">
          <Avatar name="Jane Doe" size={36} />
          <div>
            <p className="text-sm font-bold">Jane Doe</p>
            <p className="text-xs text-muted">Level 300</p>
          </div>
          <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-primary text-primary-fg">
            <IconCheck size={13} strokeWidth={3} />
          </span>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-primary">
        {["8+ characters", "A letter", "A number"].map((r) => (
          <li key={r} className="flex items-center gap-1">
            <IconCheck size={11} strokeWidth={3} /> {r}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RegisteredChip() {
  return (
    <Chip>
      <Donut
        segments={[{ key: "r", label: "Registered", value: 72, color: "var(--series-1)" }]}
        total={100}
        size={52}
        thickness={7}
        label="Sample: 72% of students registered"
        center={() => <span className="num text-[11px] font-extrabold">72%</span>}
      />
      <div>
        <p className="text-xs text-muted">Already registered</p>
        <p className="num text-base font-extrabold tracking-tight">1,440 students</p>
      </div>
    </Chip>
  );
}

// ---- password reset: the email that arrives --------------------------------------------------------

function ResetMailCard() {
  return (
    <Card className="w-[300px]">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <IconMail size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">Eksumsa Decides · just now</p>
          <p className="truncate text-sm font-bold">Reset your password</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <span className="h-2 w-[92%] rounded-full bg-subtle" />
        <span className="h-2 w-[78%] rounded-full bg-subtle" />
        <span className="h-2 w-[64%] rounded-full bg-subtle" />
      </div>
      <div className="mt-5 flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-fg">
        Reset my password
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">Link expires in 30 minutes</p>
    </Card>
  );
}

function NewPasswordChip() {
  return (
    <Chip>
      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-fg">
        <IconKey size={17} />
      </span>
      <div>
        <p className="text-xs text-muted">New password</p>
        <p className="num text-base font-extrabold tracking-[0.2em]">••••••••</p>
      </div>
      <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary">
        <IconCheck size={11} strokeWidth={3} />
      </span>
    </Chip>
  );
}

// ---- layout ---------------------------------------------------------------------------------------

const COPY: Record<ShowcaseKind, { title: string; body: string }> = {
  "student-login": { title: "Your ballot is waiting.", body: "Log in to see who's standing and cast your vote when polls open." },
  "staff-login": { title: "Run the election.", body: "Manage students, publish ballots and watch the count come in live." },
  register: { title: "On the list? You're in.", body: "Enter your number, choose a password, and confirm with the code we email you." },
  reset: { title: "Locked out? No problem.", body: "We'll email you a secure, one-time link to choose a new password." },
};

export function AuthShowcase({ kind }: { kind: ShowcaseKind }) {
  const copy = COPY[kind];
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-10">
      <div className="relative h-[400px] w-[380px]">
        {kind === "student-login" && (
          <>
            <div className="absolute left-0 top-6 -rotate-[5deg]">
              <div className="animate-float"><BallotPreviewCard /></div>
            </div>
            <div className="absolute bottom-6 right-0 z-10 rotate-[4deg]">
              <div className="animate-float-late"><OpensChip /></div>
            </div>
          </>
        )}
        {kind === "staff-login" && (
          <>
            <div className="absolute right-0 top-2 rotate-[4deg]">
              <div className="animate-float"><LiveCountCard /></div>
            </div>
            <div className="absolute bottom-4 left-0 z-10 -rotate-[5deg]">
              <div className="animate-float-late"><ActivityChip /></div>
            </div>
          </>
        )}
        {kind === "register" && (
          <>
            <div className="absolute left-4 top-4 rotate-[-3deg]">
              <div className="animate-float"><LookupCard /></div>
            </div>
            <div className="absolute bottom-8 right-0 z-10 rotate-[5deg]">
              <div className="animate-float-late"><RegisteredChip /></div>
            </div>
          </>
        )}
        {kind === "reset" && (
          <>
            <div className="absolute left-2 top-6 -rotate-[4deg]">
              <div className="animate-float"><ResetMailCard /></div>
            </div>
            <div className="absolute bottom-10 right-0 z-10 rotate-[4deg]">
              <div className="animate-float-late"><NewPasswordChip /></div>
            </div>
          </>
        )}
      </div>
      <div className="max-w-sm text-center">
        <p className="text-2xl font-extrabold tracking-[-0.03em]">{copy.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.body}</p>
      </div>
    </div>
  );
}
