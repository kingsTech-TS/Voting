import type { Metadata } from "next";
import { AuditLogs } from "./audit-logs";

export const metadata: Metadata = { title: "Activity logs" };

export default function AuditLogsPage() {
  return <AuditLogs />;
}
