import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSpinner } from "@/components/ui";
import { ElectionBuilder } from "./builder";

export const metadata: Metadata = { title: "Election" };

export default function ElectionPage({ params }: PageProps<"/admin/elections/[id]">) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Resolve params={params} />
    </Suspense>
  );
}

async function Resolve({ params }: { params: PageProps<"/admin/elections/[id]">["params"] }) {
  const { id } = await params;
  return <ElectionBuilder id={id} />;
}
