import type { Metadata } from "next";
import { SuperAdminOverview } from "./overview";

export const metadata: Metadata = { title: "Super admin overview" };

export default function SuperAdminOverviewPage() {
  return <SuperAdminOverview />;
}
