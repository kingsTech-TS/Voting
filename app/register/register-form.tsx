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
import type { MessageOut, StudentLookupOut } from "@/lib/api/types";
import { IDENTIFIER_HINT, check, identifierType, normalizeIdentifier, registerSchema, type FieldErrors } from "@/lib/validation";

type Lookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; data: StudentLookupOut }
  | { status: "error"; error: ApiError };

export function RegisterForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
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
    if (!result.data || lookup.status !== "found") return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<MessageOut>("auth/student/register", {
        json: { identifier: normalized, password, confirm_password: confirm },
      });
      toast.success(res.message);
      router.push(`/login?identifier=${encodeURIComponent(normalized)}`);
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  const showFormatError = identifier.length > 0 && !valid && normalized.length >= 9;

  return (
    <AuthLayout
      showcase="register"
      title="Student registration"
      subtitle="Enter the Matric or Registration number your admin added."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
              </dl>
            </div>
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

        {lookup.status === "found" && (
          <>
            <TextField
              label="Password"
              name="password"
              type="password"
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
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm_password ?? (confirm && confirm !== password ? "Passwords do not match." : null)}
            />
            <Button type="submit" size="lg" loading={loading} disabled={submitBlock.blocked}>
              Register
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
