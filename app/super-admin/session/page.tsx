import type { Metadata } from "next";
import { SessionPage } from "./session";

export const metadata: Metadata = { title: "Session" };

export default function SuperAdminSessionPage() {
  return <SessionPage />;
}
