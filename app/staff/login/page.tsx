import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { StaffLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff login" };

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <StaffLoginForm />
    </Suspense>
  );
}
