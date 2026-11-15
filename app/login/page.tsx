import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { StudentLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Student login" };

export default function StudentLoginPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <StudentLoginForm />
    </Suspense>
  );
}
