import type { Metadata } from "next";
import { ElectionsTable } from "@/components/staff";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Elections" };

export default function SuperAdminElectionsPage() {
  return (
    <>
      <PageHeader title="Elections" description="Watch voting live and stop an ongoing election if needed." />
      <ElectionsTable basePath="/super-admin/elections" />
    </>
  );
}
