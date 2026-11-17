import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { ImportStudents } from "./import";

export const metadata: Metadata = { title: "Import students" };

export default function ImportStudentsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ImportStudents />
    </Suspense>
  );
}
