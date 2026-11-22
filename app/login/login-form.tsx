"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/shell";
import { FormError, destinationAfterLogin, useFlash, useRetryAfter } from "@/components/auth";
import { Button, TextField } from "@/components/ui";
import { loginStudent } from "@/lib/api/client";
import { IDENTIFIER_HINT, check, normalizeIdentifier, studentLoginSchema, type FieldErrors } from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";

export function StudentLoginForm() {
  useFlash();
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState(params.get("identifier") ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const { blocked, remaining } = useRetryAfter(error);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(studentLoginSchema, { identifier, password });
    setErrors(result.errors ?? {});
    if (!result.data) return focusFirstError();
    setLoading(true);
    setError(null);
    try {
      const session = await loginStudent(normalizeIdentifier(identifier), password);
      router.replace(destinationAfterLogin(session, params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showcase="student-login"
      title="Student login"
      subtitle="Use your Matric or Registration number."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Register
          </Link>
          <span className="mx-2">·</span>
          <Link href="/staff/login" className="hover:underline">
            Staff login
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError error={error} blockedFor={remaining} />
        <TextField
          label="Matric / Registration number"
          name="identifier"
          autoComplete="username"
          inputMode="text"
          autoCapitalize="characters"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onBlur={() => setIdentifier((v) => normalizeIdentifier(v))}
          error={errors.identifier}
          hint={IDENTIFIER_HINT}
        />
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Link
            href={identifier ? `/forgot-password?login=${encodeURIComponent(normalizeIdentifier(identifier))}` : "/forgot-password"}
            className="self-end text-[13px] font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={loading} disabled={blocked}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
