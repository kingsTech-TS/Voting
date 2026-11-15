import type { Metadata } from "next";
import Link from "next/link";
import { IconPlus } from "@/components/icons";
import { ElectionsTable } from "@/components/staff";
import { buttonClass } from "@/components/styles";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Elections" };

export default function AdminElectionsPage() {
  return (
    <>
      <PageHeader
        title="Elections"
        description="Build an election as a draft, then publish it. Only one election can be scheduled or running at a time."
        actions={
          <Link href="/admin/elections/new" className={buttonClass("ink")}>
            <IconPlus size={16} /> New election
          </Link>
        }
      />
      <ElectionsTable basePath="/admin/elections" />
    </>
  );
}
