import type { Metadata } from "next";
import { AdminStudents } from "./students";

export const metadata: Metadata = { title: "Students" };

export default function AdminStudentsPage() {
  return <AdminStudents />;
}
