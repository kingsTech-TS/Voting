"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CurrentElectionCard, RegistrationCard, StatCard, useStudentCounts } from "@/components/overview";
import { IconInbox, IconPlus, IconUsers } from "@/components/icons";
import { PageHeader, buttonClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { StaffOut } from "@/lib/api/types";

export function AdminOverview() {
  const counts = useStudentCounts("admin/students");
  const me = useQuery({ queryKey: ["staff", "me"], queryFn: () => api<StaffOut>("auth/staff/me"), staleTime: 300_000 });
  const unread = useQuery({
    queryKey: ["admin", "unread"],
    queryFn: () => api<{ unread: number }>("admin/messages/unread-count"),
  });
  const firstName = me.data?.full_name?.split(" ")[0];
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={firstName ? `Welcome back, ${firstName}` : "Overview"}
        actions={
          <Link href="/admin/elections/new" className={buttonClass("primary")}>
            <IconPlus size={16} /> New election
          </Link>
        }
      />
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CurrentElectionCard basePath="/admin/elections" />
        <div className="flex flex-col gap-4">
          <RegistrationCard total={counts.total} registered={counts.registered} href="/admin/students" />
          <div className="stagger grid grid-cols-2 gap-4">
            <StatCard label="Students" value={counts.total} href="/admin/students" icon={<IconUsers size={17} />} />
            <StatCard label="Unread" value={unread.data?.unread} href="/admin/messages" icon={<IconInbox size={17} />} />
          </div>
        </div>
      </div>
    </>
  );
}
