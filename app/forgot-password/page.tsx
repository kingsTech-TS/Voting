import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
