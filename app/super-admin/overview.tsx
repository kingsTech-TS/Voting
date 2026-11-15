"use client";

import { useQuery } from "@tanstack/react-query";
import { CurrentElectionCard, RegistrationCard, StatCard, useStudentCounts } from "@/components/overview";
import { IconAlert, IconShield } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { Page, StaffOut } from "@/lib/api/types";

export function SuperAdminOverview() {
  const counts = useStudentCounts("super-admin/students");
  const admins = useQuery({
    queryKey: ["admins", "count"],
    queryFn: () => api<Page<StaffOut>>("super-admin/admins", { query: { page_size: 1 } }),
  });
  const suspended = useQuery({
    queryKey: ["admins", "count", "suspended"],
    queryFn: () => api<Page<StaffOut>>("super-admin/admins", { query: { page_size: 1, status: "suspended" } }),
  });
  return (
    <>
      <PageHeader eyebrow="Overview" title="Election oversight" description="Admins, students and the current election at a glance." />
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CurrentElectionCard basePath="/super-admin/elections" />
        <div className="flex flex-col gap-4">
          <RegistrationCard total={counts.total} registered={counts.registered} href="/super-admin/students" />
          <div className="stagger grid grid-cols-2 gap-4">
            <StatCard label="Admins" value={admins.data?.total} href="/super-admin/admins" icon={<IconShield size={17} />} />
            <StatCard label="Suspended" value={suspended.data?.total} href="/super-admin/admins" icon={<IconAlert size={17} />} />
          </div>
        </div>
      </div>
    </>
  );
}
