"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EMPTY_ELECTION_FORM, ElectionForm } from "@/components/election-form";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { ElectionOut } from "@/lib/api/types";
import { toAwareISO } from "@/lib/time";

export function NewElection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <>
      <PageHeader
        title="New election"
        description={
          <>
            Creates a draft. You&apos;ll add positions and candidates next.{" "}
            <Link href="/admin/elections" className="text-primary hover:underline">
              Back to elections
            </Link>
          </>
        }
      />
      <Card className="max-w-2xl">
        <ElectionForm
          initial={EMPTY_ELECTION_FORM}
          submitLabel="Create draft"
          onSubmit={async (v) => {
            const e = await api<ElectionOut>("admin/elections", {
              json: {
                title: v.title.trim(),
                description: v.description.trim() || null,
                start_time: toAwareISO(v.start_time),
                end_time: toAwareISO(v.end_time),
                auto_share_results: v.auto_share_results,
              },
            });
            queryClient.setQueryData(["election", e.id], e);
            void queryClient.invalidateQueries({ queryKey: ["elections"] });
            toast.success("Draft created.");
            router.push(`/admin/elections/${e.id}`);
          }}
        />
      </Card>
    </>
  );
}
