import type { Metadata } from "next";
import { StudentsTable } from "@/components/staff";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Students" };

export default function SuperAdminStudentsPage() {
  return (
    <>
      <PageHeader title="Students" description="Read-only. Admins add and manage students." />
      <StudentsTable endpoint="super-admin/students" />
    </>
  );
}
