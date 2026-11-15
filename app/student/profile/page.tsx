import type { Metadata } from "next";
import { StudentProfile } from "./profile";

export const metadata: Metadata = { title: "My profile" };

export default function StudentProfilePage() {
  return <StudentProfile />;
}
