import type { Metadata } from "next";
import { Suspense } from "react";
import { ArchiveDetail } from "@/components/archives";
import { PageSpinner } from "@/components/ui";

export const metadata: Metadata = { title: "Archived election" };

export default function ArchivedElectionPage({ params }: PageProps<"/super-admin/archives/[id]">) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Resolve params={params} />
    </Suspense>
  );
}

async function Resolve({ params }: { params: PageProps<"/super-admin/archives/[id]">["params"] }) {
  const { id } = await params;
  return <ArchiveDetail id={id} basePath="/super-admin/archives" />;
}
