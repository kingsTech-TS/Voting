import type { ReactNode } from "react";
import { StaffShell } from "@/components/shell";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return <StaffShell role="super_admin">{children}</StaffShell>;
}
