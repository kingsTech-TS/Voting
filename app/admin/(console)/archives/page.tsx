import type { Metadata } from "next";
import { ArchivesList } from "@/components/archives";

export const metadata: Metadata = { title: "Archives" };

export default function ArchivesPage() {
  return <ArchivesList basePath="/admin/archives" />;
}
