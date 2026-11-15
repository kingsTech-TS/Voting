import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { AdminLive } from "./live";

export const metadata: Metadata = { title: "Live count" };

export default function AdminLivePage({ params }: PageProps<"/admin/elections/[id]/live">) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Resolve params={params} />
    </Suspense>
  );
}

async function Resolve({ params }: { params: PageProps<"/admin/elections/[id]/live">["params"] }) {
  const { id } = await params;
  return <AdminLive id={id} />;
}
