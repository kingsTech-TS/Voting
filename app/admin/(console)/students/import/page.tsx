import type { Metadata } from "next";
import { ImportStudents } from "./import";

export const metadata: Metadata = { title: "Import students" };

export default function ImportStudentsPage() {
  return <ImportStudents />;
}
