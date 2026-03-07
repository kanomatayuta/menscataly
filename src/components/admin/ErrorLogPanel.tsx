"use client";

import { useState, useMemo } from "react";

export interface ErrorLogEntry {
  id: string;
  type: string;
  severity: string; // "critical" | "warning" | "info"
  title: string;
  message: string;
  createdAt: string;
  status: string; // "active" | "acknowledged" | "resolved"
}

export interface ErrorLogPanelProps {
  errors: ErrorLogEntry[];
}

const TYPE_LABELS: Record<string, string> = {
  pipeline_failure: "パイプライン失敗",
  compliance_violation: "コンプラ違反",
  performance_degradation: "パフォーマンス低下",
  cost_threshold: "コスト超過",
  api_error: "APIエラー",
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_STYLES: Record<
  string,
  { badge: string; bg: string; text: string; border: string; fadedBadge: string }
> = {
  critical: {
    badge: "bg-red-100 text-red-700",
    fadedBadge: "bg-red-50 text-red-300",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
  warning: {
    badge: "bg-amber-100 text-amber-700",
    fadedBadge: "bg-amber-50 text-amber-300",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  info: {
    badge: "bg-blue-100 text-blue-700",
    fadedBadge: "bg-blue-50 text-blue-300",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "重大",
  warning: "警告",
  info: "情報",
};

interface ErrorGroup {
  type: string;
  severity: string;
  entries: ErrorLogEntry[];
  latestAt: string;
}

const ITEMS_PER_GROUP = 5;
const DEFAULT_VISIBLE_GROUPS = 5;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ErrorLogPanel({ errors }: ErrorLogPanelProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllGroups, setShowAllGroups] = useState(false);

  const filteredErrors = useMemo(
    () =>
      showResolved
        ? errors
        : errors.filter((e) => e.status !== "resolved"),
    [errors, showResolved],
  );

  // Severity summary counts (always based on filtered)
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    for (const e of filteredErrors) {
      if (counts[e.severity] !== undefined) {
        counts[e.severity]++;
      }
    }
    return counts;
  }, [filteredErrors]);

  // Group by type, sorted by highest severity in group
  const groups = useMemo(() => {
    const map = new Map<string, ErrorGroup>();
    for (const entry of filteredErrors) {
      const existing = map.get(entry.type);
      if (!existing) {
        map.set(entry.type, {
          type: entry.type,
          severity: entry.severity,
          entries: [entry],
          latestAt: entry.createdAt,
        });
      } else {
        existing.entries.push(entry);
        if (
          (SEVERITY_ORDER[entry.severity] ?? 99) <
          (SEVERITY_ORDER[existing.severity] ?? 99)
        ) {
          existing.severity = entry.severity;
        }
        if (entry.createdAt > existing.latestAt) {
          existing.latestAt = entry.createdAt;
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
    );
  }, [filteredErrors]);

  const visibleGroups = showAllGroups
    ? groups
    : groups.slice(0, DEFAULT_VISIBLE_GROUPS);
  const hiddenGroupCount = groups.length - DEFAULT_VISIBLE_GROUPS;

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return iso;
    }
  };

  // Empty state
  if (errors.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-center text-sm font-medium text-green-600">
          エラーなし — 正常に稼働中
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Header: severity badges + filter */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex gap-2">
          {(["critical", "warning", "info"] as const).map((sev) => {
            const count = severityCounts[sev] ?? 0;
            const styles = SEVERITY_STYLES[sev];
            return (
              <span
                key={sev}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  count > 0 ? styles.badge : styles.fadedBadge
                }`}
              >
                {SEVERITY_LABELS[sev]} {count}
              </span>
            );
          })}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowResolved(false)}
            className={`rounded px-2 py-1 text-xs font-medium ${
              !showResolved
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            未解決のみ
          </button>
          <button
            type="button"
            onClick={() => setShowResolved(true)}
            className={`rounded px-2 py-1 text-xs font-medium ${
              showResolved
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            全件表示
          </button>
        </div>
      </div>

      {/* Empty filtered state */}
      {filteredErrors.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm font-medium text-green-600">
            エラーなし — 正常に稼働中
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleGroups.map((group) => {
            const isOpen = expandedGroups.has(group.type);
            const styles = SEVERITY_STYLES[group.severity] ?? SEVERITY_STYLES.info;
            const label = TYPE_LABELS[group.type] ?? group.type;
            const visibleEntries = group.entries.slice(0, ITEMS_PER_GROUP);
            const hiddenEntryCount = group.entries.length - ITEMS_PER_GROUP;

            return (
              <div key={group.type}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.type)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <ChevronIcon open={isOpen} />
                  <span
                    className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${styles.badge}`}
                  >
                    {SEVERITY_LABELS[group.severity] ?? group.severity}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {label}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({group.entries.length}件)
                  </span>
                  <span className="ml-auto text-xs text-slate-400">
                    最終: {formatDateTime(group.latestAt)}
                  </span>
                </button>

                {/* Expanded entries */}
                {isOpen && (
                  <div className="border-t border-slate-50 bg-slate-50/50 px-4 py-2">
                    <ul className="space-y-1.5">
                      {visibleEntries.map((entry) => {
                        const entrySev =
                          SEVERITY_STYLES[entry.severity] ?? SEVERITY_STYLES.info;
                        return (
                          <li
                            key={entry.id}
                            className={`rounded border px-3 py-2 ${entrySev.bg} ${entrySev.border}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p
                                  className={`truncate text-xs font-medium ${entrySev.text}`}
                                >
                                  {entry.title}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {entry.message}
                                </p>
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-2">
                                {entry.status === "acknowledged" && (
                                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                                    確認済
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400">
                                  {formatDateTime(entry.createdAt)}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {hiddenEntryCount > 0 && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        他{hiddenEntryCount}件
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Show more groups button */}
          {!showAllGroups && hiddenGroupCount > 0 && (
            <div className="px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => setShowAllGroups(true)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                他{hiddenGroupCount}グループを表示
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
