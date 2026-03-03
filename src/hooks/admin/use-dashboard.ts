"use client";

import useSWR from "swr";
import type { AdminDashboardData } from "@/types/admin";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * SWR hook for admin dashboard data.
 * Auto-refreshes every 30 seconds.
 */
export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR<AdminDashboardData>(
    "/api/admin/dashboard",
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    },
  );

  return { data, error, isLoading, mutate };
}
