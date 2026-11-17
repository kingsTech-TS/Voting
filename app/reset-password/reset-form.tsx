"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell";
import { FormError, PasswordChecklist, useRetryAfter } from "@/components/auth";
import { IconAlert } from "@/components/icons";
import { buttonClass } from "@/components/styles";
import { Button, PageSpinner, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { PasswordResetOut, ResetTokenCheckOut } from "@/lib/api/types";
import { check, resetPasswordSchema, type FieldErrors } from "@/lib/validation";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);
  const { blocked, remaining } = useRetryAfter(error);

  const tokenCheck = useQuery({
    queryKey: ["reset-token", token],
    queryFn: () => api<ResetTokenCheckOut>("auth/student/reset-password", { query: { token } }),
    enabled: token.length >= 20,
    retry: false,
    staleTime: Infinity,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(resetPasswordSchema, { password, confirm_password: confirm });
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<PasswordResetOut>("auth/student/reset-password", {
        json: { token, password, confirm_password: confirm },
      });
      toast.success(res.message);
      router.replace(`/login?identifier=${encodeURIComponent(res.identifier)}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_RESET_TOKEN") setExpired(true);
      else setError(err);
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

  if (token.length >= 20 && tokenCheck.isPending) {
    return (
      <AuthLayout showcase="reset" title="Reset password" footer={footer}>
        <PageSpinner label="Checking your link…" />
      </AuthLayout>
    );
  }

  const invalid = token.length < 20 || expired || tokenCheck.data?.valid === false;
  if (invalid) {
    return (
      <AuthLayout showcase="reset" title="Link expired" footer={footer}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-danger-soft px-6 py-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-danger text-white">
              <IconAlert size={24} />
            </span>
            <div>
              <p className="text-base font-bold">This reset link can&apos;t be used</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                Reset links expire after 30 minutes and work only once. Request a fresh one and use the newest email.
              </p>
            </div>
          </div>
          <Link href="/forgot-password" className={buttonClass("primary", "lg")}>
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const info = tokenCheck.data;
  return (
    <AuthLayout
      showcase="reset"
      title="Create a new password"
      subtitle={
        info?.full_name ? (
          <>
            Hi <span className="font-semibold text-foreground">{info.full_name.split(" ")[0]}</span>, choose a new password for
            your account{info.email_hint ? <> ({info.email_hint})</> : null}.
          </>
        ) : (
          "Choose a new password for your account."
        )
      }
      footer={footer}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError error={error ?? tokenCheck.error} blockedFor={remaining} />
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={<PasswordChecklist value={password} />}
        />
        <TextField
          label="Confirm new password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm_password ?? (confirm && confirm !== password ? "Passwords do not match." : null)}
        />
        <Button type="submit" size="lg" loading={loading} disabled={blocked}>
          Save new password
        </Button>
        <p className="text-center text-xs text-muted">You&apos;ll be signed out on every other device.</p>
      </form>
    </AuthLayout>
  );
}
