"use client";

import useSWR from "swr";
import type { MonitoringAlert } from "@/types/admin";

interface AlertsResponse {
  alerts: MonitoringAlert[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * SWR hook for admin alerts with acknowledge mutation.
 */
export function useAlerts() {
  const { data, error, isLoading, mutate } = useSWR<AlertsResponse>(
    "/api/admin/alerts",
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    },
  );

  /**
   * Acknowledge an alert by calling PATCH /api/admin/alerts.
   * Optimistically updates the local cache.
   */
  async function acknowledgeAlert(alertId: string) {
    // Optimistic update
    await mutate(
      async (currentData) => {
        const res = await fetch("/api/admin/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alertId, action: "acknowledge" }),
        });

        if (!res.ok) {
          throw new Error("Failed to acknowledge alert");
        }

        // Update local data
        if (!currentData) return currentData;
        return {
          alerts: currentData.alerts.map((alert) =>
            alert.id === alertId
              ? {
                  ...alert,
                  status: "acknowledged" as const,
                  acknowledgedAt: new Date().toISOString(),
                }
              : alert,
          ),
        };
      },
      { revalidate: true },
    );
  }

  return {
    data,
    alerts: data?.alerts ?? [],
    error,
    isLoading,
    mutate,
    acknowledgeAlert,
  };
}
