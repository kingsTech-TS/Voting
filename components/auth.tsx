"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { IconCheck } from "./icons";
import { toast } from "sonner";
import { takeFlash } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { SessionOut } from "@/lib/api/types";
import { homeFor } from "@/lib/session";
import { formatDuration } from "@/lib/time";
import { PASSWORD_RULES } from "@/lib/validation";
import { Alert } from "./ui";

/** Show the message endSession() left (e.g. "Your account has been suspended"). */
export function useFlash() {
  useEffect(() => {
    const msg = takeFlash();
    if (msg) toast.error(msg);
  }, []);
}

/** Where to go after login: the `next` param if it belongs to this role's area, else the role home. */
export function destinationAfterLogin(session: SessionOut, next: string | null): string {
  if (session.onboarding_required) return homeFor(session.role, session.onboarding_required);
  const home = homeFor(session.role);
  if (next && next.startsWith("/") && !next.startsWith("//") && (next === home || next.startsWith(`${home}/`))) return next;
  return home;
}

/** Banner for 429s with a live countdown from Retry-After. Returns true while still blocked. */
export function useRetryAfter(error: unknown) {
  const until = error instanceof ApiError ? error.retryAt : undefined;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [until]);
  // Before the first tick, assume the full wait is still ahead.
  const remaining = !until ? 0 : now === null ? ((error as ApiError).retryAfter ?? 60) * 1000 : Math.max(0, until - now);
  return { blocked: remaining > 0, remaining };
}

export function FormError({ error, blockedFor }: { error: unknown; blockedFor?: number }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <Alert tone="danger">
      {message}
      {blockedFor && blockedFor > 0 ? <span className="block pt-1 font-medium">Try again in {formatDuration(blockedFor)}.</span> : null}
    </Alert>
  );
}

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={clsx("flex items-center gap-1.5 transition-colors", ok ? "text-primary" : "text-muted")}>
            <span
              className={clsx(
                "flex size-3.5 items-center justify-center rounded-full border transition-colors",
                ok ? "border-primary bg-primary text-primary-fg" : "border-border-strong",
              )}
            >
              {ok && <IconCheck size={9} strokeWidth={3.5} />}
            </span>
            {r.label}
            <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
