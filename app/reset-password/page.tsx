import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
