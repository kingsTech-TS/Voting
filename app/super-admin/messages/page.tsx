import type { Metadata } from "next";
import { SuperAdminMessages } from "./messages";

export const metadata: Metadata = { title: "Messages" };

export default function SuperAdminMessagesPage() {
  return <SuperAdminMessages />;
}
