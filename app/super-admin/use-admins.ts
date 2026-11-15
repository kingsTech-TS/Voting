"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Page, StaffOut } from "@/lib/api/types";

/** Every (non-deleted) admin, for pickers and id → email lookups. */
export function useAllAdmins() {
  return useQuery({
    queryKey: ["admins", "all"],
    queryFn: () => api<Page<StaffOut>>("super-admin/admins", { query: { page_size: 200 } }),
    staleTime: 60_000,
    select: (page) => page.items,
  });
}
