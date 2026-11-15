"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/shell";
import { FormError, destinationAfterLogin, useFlash, useRetryAfter } from "@/components/auth";
import { Button, TextField } from "@/components/ui";
import { loginStaff } from "@/lib/api/client";
import { check, staffLoginSchema, type FieldErrors } from "@/lib/validation";

export function StaffLoginForm() {
  useFlash();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const { blocked, remaining } = useRetryAfter(error);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(staffLoginSchema, { email, password });
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setLoading(true);
    setError(null);
    try {
      const session = await loginStaff(result.data.email, password);
      router.replace(destinationAfterLogin(session, params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showcase="staff-login"
      title="Staff login"
      subtitle="For admins and the super admin."
      footer={
        <Link href="/login" className="hover:underline">
          Student login
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError error={error} blockedFor={remaining} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="First time? Use the temporary password the super admin gave you."
        />
        <Button type="submit" size="lg" loading={loading} disabled={blocked}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
