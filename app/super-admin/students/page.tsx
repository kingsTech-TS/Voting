import type { Metadata } from "next";
import { SuperAdminStudents } from "./students";

export const metadata: Metadata = { title: "Students" };

export default function SuperAdminStudentsPage() {
  return <SuperAdminStudents />;
}
