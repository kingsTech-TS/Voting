"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell";
import { FormError, PasswordChecklist, useRetryAfter } from "@/components/auth";
import { Alert, Button, Spinner, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { MessageOut, StudentLookupOut, StudentRegisterStartedOut } from "@/lib/api/types";
import {
  IDENTIFIER_HINT,
  check,
  identifierType,
  normalizeIdentifier,
  otpSchema,
  registerSchema,
  type FieldErrors,
} from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";

type Lookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; data: StudentLookupOut }
  | { status: "error"; error: ApiError };

/** A sign-up waiting for the emailed code. */
type Pending = { identifier: string; started: StudentRegisterStartedOut; sentAt: number };

/** Codes that mean the pending sign-up is gone: start again from step 1. */
const RESTART_CODES = new Set(["REGISTRATION_EXPIRED", "REGISTRATION_CHANGED", "NO_EMAIL_ON_FILE", "STUDENT_NOT_FOUND"]);

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  // Set when a pending sign-up was dropped, shown on step 1.
  const [restartReason, setRestartReason] = useState<string | null>(null);
  // Kept so going back to step 1 doesn't make the student retype their number.
  const [lastIdentifier, setLastIdentifier] = useState("");

  return (
    <AuthLayout
      showcase="register"
      title={pending ? "Check your email" : "Student registration"}
      subtitle={
        pending ? (
          <>
            We sent a 6-digit code to <span className="font-semibold text-foreground">{pending.started.email_hint}</span>.
          </>
        ) : (
          "Enter the Matric or Registration number your admin added."
        )
      }
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {pending ? (
        <VerifyStep
          pending={pending}
          onResent={(started) => setPending({ ...pending, started, sentAt: Date.now() })}
          onRestart={(reason) => {
            setRestartReason(reason);
            setLastIdentifier(pending.identifier);
            setPending(null);
          }}
          onDone={(message) => {
            toast.success(message);
            router.push(`/login?identifier=${encodeURIComponent(pending.identifier)}`);
          }}
        />
      ) : (
        <DetailsStep
          initialIdentifier={lastIdentifier}
          restartReason={restartReason}
          onStarted={(identifier, started) => {
            setRestartReason(null);
            setPending({ identifier, started, sentAt: Date.now() });
          }}
        />
      )}
    </AuthLayout>
  );
}

// ---- step 1: number + password --------------------------------------------------------------------

function DetailsStep({
  initialIdentifier,
  restartReason,
  onStarted,
}: {
  initialIdentifier: string;
  restartReason: string | null;
  onStarted: (identifier: string, started: StudentRegisterStartedOut) => void;
}) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  // The last lookup result, tagged with the identifier it belongs to.
  const [result, setResult] = useState<{ for: string; lookup: Lookup }>({ for: "", lookup: { status: "idle" } });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const normalized = normalizeIdentifier(identifier);
  const valid = identifierType(identifier) !== null;
  // Derived: nothing for an invalid format, "loading" until the debounced lookup for this value returns.
  const lookup: Lookup = !valid ? { status: "idle" } : result.for === normalized ? result.lookup : { status: "loading" };
  const lookupBlock = useRetryAfter(lookup.status === "error" ? lookup.error : null);
  const submitBlock = useRetryAfter(error);
  const canRegister = lookup.status === "found" && lookup.data.email_hint !== null;

  // Debounced lookup as soon as the identifier has a valid format.
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await api<StudentLookupOut>("auth/student/lookup", {
          json: { identifier: normalized },
          signal: controller.signal,
        });
        setResult({ for: normalized, lookup: { status: "found", data } });
      } catch (err) {
        if (controller.signal.aborted) return;
        setResult({
          for: normalized,
          lookup: {
            status: "error",
            error: err instanceof ApiError ? err : new ApiError(0, { code: "NETWORK_ERROR", message: "Lookup failed." }),
          },
        });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized, valid]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(registerSchema, { identifier, password, confirm_password: confirm });
    setErrors(result.errors ?? {});
    if (!result.data || !canRegister) return focusFirstError();
    setLoading(true);
    setError(null);
    try {
      const started = await api<StudentRegisterStartedOut>("auth/student/register", {
        json: { identifier: normalized, password, confirm_password: confirm },
      });
      toast.success(started.message);
      onStarted(normalized, started);
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  const showFormatError = identifier.length > 0 && !valid && normalized.length >= 9;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {restartReason && !error && <Alert tone="warning">{restartReason}</Alert>}
      <FormError error={error} blockedFor={submitBlock.remaining} />
      <TextField
        label="Matric / Registration number"
        name="identifier"
        autoComplete="username"
        autoCapitalize="characters"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        onBlur={() => setIdentifier((v) => normalizeIdentifier(v))}
        error={showFormatError ? "Enter a valid Matric or Registration number." : errors.identifier}
        hint={IDENTIFIER_HINT}
      />

      <div aria-live="polite">
        {lookup.status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="size-4" /> Checking…
          </div>
        )}
        {lookup.status === "found" && (
          <div className="rounded-2xl bg-primary-soft p-4">
            <p className="text-xs font-bold text-primary">Is this you?</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Full name</dt>
              <dd className="font-semibold">{lookup.data.full_name}</dd>
              <dt className="text-muted">Level</dt>
              <dd className="font-semibold">{lookup.data.level}</dd>
              {lookup.data.email_hint && (
                <>
                  <dt className="text-muted">Email</dt>
                  <dd className="font-semibold break-all">{lookup.data.email_hint}</dd>
                </>
              )}
            </dl>
          </div>
        )}
        {lookup.status === "found" && !lookup.data.email_hint && (
          <Alert tone="warning" className="mt-3">
            There is no email address on file for you, so we can&apos;t send your registration code. Please contact the admin to add
            your email.
          </Alert>
        )}
        {lookup.status === "error" && lookup.error.code === "ALREADY_REGISTERED" && (
          <Alert tone="warning">
            {lookup.error.message}{" "}
            <Link href={`/login?identifier=${encodeURIComponent(normalized)}`} className="font-semibold underline">
              Go to login
            </Link>
          </Alert>
        )}
        {lookup.status === "error" && lookup.error.code !== "ALREADY_REGISTERED" && (
          <Alert tone="danger">
            {lookup.error.message}
            {lookupBlock.blocked && <span className="block pt-1">Try again in {Math.ceil(lookupBlock.remaining / 1000)}s.</span>}
          </Alert>
        )}
      </div>

      {canRegister && (
        <>
          <TextField
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint={<PasswordChecklist value={password} />}
          />
          <TextField
            label="Confirm password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm_password ?? (confirm && confirm !== password ? "Passwords do not match." : null)}
          />
          <p className="text-xs leading-relaxed text-muted">
            We&apos;ll email a 6-digit code to the address above to confirm it&apos;s you.
          </p>
          <Button type="submit" size="lg" loading={loading} disabled={submitBlock.blocked}>
            Send code
          </Button>
        </>
      )}
    </form>
  );
}

// ---- step 2: the emailed code ---------------------------------------------------------------------

/** Seconds left until `sentAt + seconds`, ticking once a second. */
function useCountdown(sentAt: number, seconds: number) {
  const [now, setNow] = useState(sentAt);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sentAt]);
  return Math.max(0, Math.ceil((sentAt + seconds * 1000 - now) / 1000));
}

function formatClock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function VerifyStep({
  pending,
  onResent,
  onRestart,
  onDone,
}: {
  pending: Pending;
  onResent: (started: StudentRegisterStartedOut) => void;
  onRestart: (reason: string) => void;
  onDone: (message: string) => void;
}) {
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // A wrong code too many times (or an expired one) needs a fresh code before trying again.
  const [needsNewCode, setNeedsNewCode] = useState(false);

  const resendIn = useCountdown(pending.sentAt, pending.started.resend_in);
  const expiresIn = useCountdown(pending.sentAt, pending.started.expires_in);
  const errorBlock = useRetryAfter(error);
  const resendWait = Math.max(resendIn, Math.ceil(errorBlock.remaining / 1000));

  const handle = (err: unknown) => {
    if (!(err instanceof ApiError)) return setError(err);
    // Already registered: step 1's lookup then offers the login link.
    if (RESTART_CODES.has(err.code) || err.code === "ALREADY_REGISTERED") return onRestart(err.message);
    if (err.code === "INVALID_OTP") {
      setOtpError(err.message);
      return focusFirstError();
    }
    if (err.code === "OTP_EXPIRED" || err.code === "OTP_TOO_MANY_ATTEMPTS") setNeedsNewCode(true);
    setError(err);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(otpSchema, { otp });
    setOtpError(result.errors?.otp ?? null);
    if (!result.data) return focusFirstError();
    setLoading(true);
    setError(null);
    try {
      const res = await api<MessageOut>("auth/student/register/verify", {
        json: { identifier: pending.identifier, registration_token: pending.started.registration_token, otp: result.data.otp },
      });
      onDone(res.message);
    } catch (err) {
      handle(err);
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setOtpError(null);
    try {
      const started = await api<StudentRegisterStartedOut>("auth/student/register/resend", {
        json: { identifier: pending.identifier, registration_token: pending.started.registration_token },
      });
      toast.success(started.message);
      setOtp("");
      setNeedsNewCode(false);
      onResent(started);
    } catch (err) {
      handle(err);
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
      {error && !(error instanceof ApiError && error.code === "OTP_COOLDOWN") ? <FormError error={error} /> : null}
      <TextField
        label="6-digit code"
        name="otp"
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        placeholder="000000"
        style={{ textAlign: "center", fontSize: "1.25rem", letterSpacing: "0.5em", fontVariantNumeric: "tabular-nums" }}
        value={otp}
        onChange={(e) => {
          setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
          setOtpError(null);
        }}
        error={otpError}
        hint={
          expiresIn > 0 ? (
            <>
              The code expires in <span className="num font-semibold">{formatClock(expiresIn)}</span>. Check your spam folder if you
              can&apos;t find it.
            </>
          ) : (
            "This code has expired. Request a new one."
          )
        }
        disabled={needsNewCode}
      />
      <Button type="submit" size="lg" loading={loading} disabled={needsNewCode || expiresIn === 0 || otp.length !== 6}>
        Verify and create account
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="font-medium text-muted hover:text-foreground"
          onClick={() => onRestart("Start again: enter your number and choose a password.")}
        >
          ← Change details
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void resend()} loading={resending} disabled={resendWait > 0}>
          {resendWait > 0 ? `Resend code in ${resendWait}s` : "Resend code"}
        </Button>
      </div>
    </form>
  );
}
