import type { Metadata } from "next";
import { AdminOverview } from "./overview";

export const metadata: Metadata = { title: "Admin overview" };

export default function AdminOverviewPage() {
  return <AdminOverview />;
}
