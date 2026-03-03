"use client";

import { useState } from "react";
import type { MonitoringAlert, AlertSeverity } from "@/types/admin";

interface AlertsListProps {
  alerts: MonitoringAlert[];
}

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; text: string; dot: string }> = {
  critical: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    dot: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    dot: "bg-blue-500",
  },
};

export function AlertsList({ alerts: initialAlerts }: AlertsListProps) {
  const [alerts, setAlerts] = useState(initialAlerts);

  const handleAcknowledge = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              status: "acknowledged" as const,
              acknowledgedAt: new Date().toISOString(),
            }
          : alert,
      ),
    );
  };

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
        <p className="text-sm text-neutral-500">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const styles = SEVERITY_STYLES[alert.severity];
        return (
          <div
            key={alert.id}
            className={`rounded-lg border p-4 ${styles.bg}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${styles.dot}`}
                  aria-hidden="true"
                />
                <div>
                  <p className={`text-sm font-medium ${styles.text}`}>
                    {alert.title}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {alert.message}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(alert.createdAt).toLocaleString("ja-JP")}
                  </p>
                </div>
              </div>
              {alert.status === "active" && (
                <button
                  type="button"
                  onClick={() => handleAcknowledge(alert.id)}
                  className="flex-shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Acknowledge
                </button>
              )}
              {alert.status === "acknowledged" && (
                <span className="flex-shrink-0 text-xs text-neutral-400">
                  Acknowledged
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
