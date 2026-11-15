"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell";
import { FormError, PasswordChecklist } from "@/components/auth";
import { Button, TextField } from "@/components/ui";
import { completeAdminOnboarding, logout } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { adminOnboardingSchema, check, type FieldErrors } from "@/lib/validation";

export function AdminOnboarding() {
  const router = useRouter();
  const [values, setValues] = useState({ full_name: "", current_password: "", new_password: "", confirm_password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(adminOnboardingSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setLoading(true);
    setError(null);
    try {
      await completeAdminOnboarding({ ...values, full_name: values.full_name.trim() });
      toast.success("Your account is set up.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_PASSWORD") {
        setErrors({ current_password: err.message });
      } else if (err instanceof ApiError && err.code === "ALREADY_ONBOARDED") {
        router.replace("/admin");
        return;
      } else {
        setError(err);
      }
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showcase="staff-login"
      title="Set up your admin account"
      subtitle="Before you continue, add your full name and replace the temporary password."
      footer={
        <button type="button" className="hover:underline" onClick={() => void logout()}>
          Log out
        </button>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError error={error} />
        <TextField label="Full name" autoComplete="name" value={values.full_name} onChange={set("full_name")} error={errors.full_name} />
        <TextField
          label="Temporary password"
          type="password"
          autoComplete="current-password"
          value={values.current_password}
          onChange={set("current_password")}
          error={errors.current_password}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={values.new_password}
          onChange={set("new_password")}
          error={errors.new_password}
          hint={<PasswordChecklist value={values.new_password} />}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={values.confirm_password}
          onChange={set("confirm_password")}
          error={errors.confirm_password}
        />
        <Button type="submit" size="lg" loading={loading}>
          Save and continue
        </Button>
      </form>
    </AuthLayout>
  );
}
