"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/shell";
import { FormError, useRetryAfter } from "@/components/auth";
import { IconMail } from "@/components/icons";
import { Button, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { MessageOut } from "@/lib/api/types";
import { check, forgotPasswordSchema, normalizeIdentifier, type FieldErrors } from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";

export function ForgotPasswordForm() {
  const params = useSearchParams();
  const [login, setLogin] = useState(params.get("login") ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { blocked, remaining } = useRetryAfter(error);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(forgotPasswordSchema, { login });
    setErrors(result.errors ?? {});
    if (!result.data) return focusFirstError();
    const value = login.includes("@") ? login.trim().toLowerCase() : normalizeIdentifier(login);
    setLoading(true);
    setError(null);
    try {
      await api<MessageOut>("auth/student/forgot-password", { json: { login: value } });
      setSentTo(value);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      Remembered it?{" "}
      <Link href="/login" className="font-medium text-primary hover:underline">
        Back to login
      </Link>
    </>
  );

  if (sentTo) {
    return (
      <AuthLayout showcase="reset" title="Check your inbox" footer={footer}>
        <div className="flex flex-col gap-5">
          <div className="animate-fade-in flex flex-col items-center gap-4 rounded-3xl bg-primary-soft px-6 py-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[0_10px_24px_-10px_var(--primary)]">
              <IconMail size={24} />
            </span>
            <div>
              <p className="text-base font-bold">Reset link sent</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                If <span className="font-semibold">{sentTo}</span> belongs to a registered student, we&apos;ve emailed a link to
                the address used at registration.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-2.5 text-sm text-muted">
            <li className="flex gap-2.5">
              <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-bold text-foreground">1</span>
              Open the email from Eksumsa Decides. Check spam or promotions if you don&apos;t see it.
            </li>
            <li className="flex gap-2.5">
              <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-bold text-foreground">2</span>
              Click <span className="font-semibold text-foreground">Reset my password</span> within 30 minutes.
            </li>
            <li className="flex gap-2.5">
              <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-bold text-foreground">3</span>
              Choose and confirm your new password, then log in.
            </li>
          </ul>
          <p className="text-xs leading-relaxed text-muted">
            No email after a few minutes? If you registered before emails were collected, your account has no email yet. Log in
            and add one from your profile, then you can reset your password any time.
          </p>
          <Button variant="secondary" onClick={() => setSentTo(null)}>
            Send another link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      showcase="reset"
      title="Forgot password"
      subtitle="Enter your Matric/Reg number or the email you registered with. We'll send you a reset link."
      footer={footer}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError error={error} blockedFor={remaining} />
        <TextField
          label="Matric / Reg number or email"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          error={errors.login}
          placeholder="220703012 or you@example.com"
        />
        <Button type="submit" size="lg" loading={loading} disabled={blocked}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
