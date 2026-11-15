import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { SuperAdminElection } from "./election";

export const metadata: Metadata = { title: "Election" };

export default function SuperAdminElectionPage({ params }: PageProps<"/super-admin/elections/[id]">) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Resolve params={params} />
    </Suspense>
  );
}

async function Resolve({ params }: { params: PageProps<"/super-admin/elections/[id]">["params"] }) {
  const { id } = await params;
  return <SuperAdminElection id={id} />;
}
