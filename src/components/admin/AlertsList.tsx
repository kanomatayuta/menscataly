"use client";

import { useState } from "react";
import type { MonitoringAlert, AlertLevel } from "@/types/admin";

interface AlertsListProps {
  alerts: MonitoringAlert[];
}

const SEVERITY_STYLES: Record<
  AlertLevel,
  { bg: string; text: string; dot: string }
> = {
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
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const handleAcknowledge = async (alertId: string) => {
    // Mark as pending to show loading state
    setPendingIds((prev) => new Set(prev).add(alertId));

    try {
      const res = await fetch("/api/admin/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, action: "acknowledge" }),
      });

      if (!res.ok) {
        throw new Error("Failed to acknowledge alert");
      }

      // Update local state on success
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
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
      // Could add toast notification here
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const styles = SEVERITY_STYLES[alert.level];
        const isPending = pendingIds.has(alert.id);
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
                  <p className="mt-0.5 text-xs text-slate-600">
                    {alert.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {(() => {
                      const d = new Date(alert.createdAt);
                      if (isNaN(d.getTime())) return alert.createdAt;
                      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                    })()}
                  </p>
                </div>
              </div>
              {alert.status === "active" && (
                <button
                  type="button"
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={isPending}
                  className="flex-shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "..." : "Acknowledge"}
                </button>
              )}
              {alert.status === "acknowledged" && (
                <span className="flex-shrink-0 text-xs text-slate-400">
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
