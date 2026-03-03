"use client";

import useSWR from "swr";
import type { RevenueSummary } from "@/types/admin";

interface RevenueResponse {
  revenue: RevenueSummary[];
  period: {
    startDate: string;
    endDate: string;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * SWR hook for admin revenue data.
 */
export function useRevenue() {
  const { data, error, isLoading, mutate } = useSWR<RevenueResponse>(
    "/api/admin/revenue",
    fetcher,
    {
      revalidateOnFocus: true,
    },
  );

  return { data, error, isLoading, mutate };
}
