import type { Metadata } from "next";
import { AdminsManager } from "./admins";

export const metadata: Metadata = { title: "Admins" };

export default function AdminsPage() {
  return <AdminsManager />;
}
