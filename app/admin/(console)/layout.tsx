import type { ReactNode } from "react";
import { StaffShell } from "@/components/shell";

export default function AdminConsoleLayout({ children }: { children: ReactNode }) {
  return <StaffShell role="admin">{children}</StaffShell>;
}
