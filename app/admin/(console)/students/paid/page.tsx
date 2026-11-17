import type { Metadata } from "next";
import { PaidImport } from "./paid";

export const metadata: Metadata = { title: "Import paid list" };

export default function PaidImportPage() {
  return <PaidImport />;
}
