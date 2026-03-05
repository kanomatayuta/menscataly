"use client";

import { useState, useEffect, useCallback } from "react";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface AuditLogEntry {
  id: string;
  timestamp: string;
  event_type: string;
  actor: string;
  ip_address: string;
  user_agent: string;
  path: string;
  status_code: number;
  failure_reason: string | null;
  success: boolean;
}

interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const EVENT_TYPES = [
  { value: "", label: "All" },
  { value: "login_success", label: "login_success" },
  { value: "login_failure", label: "login_failure" },
  { value: "logout", label: "logout" },
  { value: "unauthorized_access", label: "unauthorized_access" },
] as const;

const PAGE_LIMIT = 50;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getEventBadgeColor(eventType: string): string {
  switch (eventType) {
    case "login_success":
      return "bg-green-100 text-green-800";
    case "login_failure":
      return "bg-red-100 text-red-800";
    case "logout":
      return "bg-neutral-100 text-neutral-800";
    case "unauthorized_access":
      return "bg-red-100 text-red-800";
    case "token_expired":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

function truncateUserAgent(ua: string, maxLen: number = 50): string {
  if (!ua) return "-";
  return ua.length > maxLen ? ua.slice(0, maxLen) + "..." : ua;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function AuditLogPage() {
  // Filter state
  const [eventType, setEventType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [failureOnly, setFailureOnly] = useState(false);
  const [offset, setOffset] = useState(0);

  // Data state
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Summary
  const [summary, setSummary] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    uniqueIps: 0,
  });

  const fetchAuditLog = useCallback(async (currentOffset: number) => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (eventType) params.set("event_type", eventType);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (failureOnly) params.set("success", "false");
    params.set("limit", String(PAGE_LIMIT));
    params.set("offset", String(currentOffset));

    try {
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error ?? `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const json: AuditLogResponse = await res.json();
      setData(json);

      // Calculate summary from current page
      const successful = json.entries.filter((e) => e.success).length;
      const failed = json.entries.filter((e) => !e.success).length;
      const uniqueIps = new Set(json.entries.map((e) => e.ip_address)).size;

      setSummary({
        total: json.total,
        successful,
        failed,
        uniqueIps,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch audit log");
    } finally {
      setLoading(false);
    }
  }, [eventType, fromDate, toDate, failureOnly]);

  // Initial fetch
  useEffect(() => {
    fetchAuditLog(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setOffset(0);
    fetchAuditLog(0);
  };

  const handlePrev = () => {
    const newOffset = Math.max(0, offset - PAGE_LIMIT);
    setOffset(newOffset);
    fetchAuditLog(newOffset);
  };

  const handleNext = () => {
    if (data && offset + PAGE_LIMIT < data.total) {
      const newOffset = offset + PAGE_LIMIT;
      setOffset(newOffset);
      fetchAuditLog(newOffset);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
            <li>
              <a
                href="/admin"
                className="hover:text-neutral-700 hover:underline"
              >
                Admin
              </a>
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-neutral-300">
                /
              </span>
              <span className="text-neutral-700">監査ログ</span>
            </li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold text-neutral-900">監査ログ</h1>
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">イベント総数</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">
            {summary.total}
          </p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600">成功</p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            {summary.successful}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-600">失敗</p>
          <p className="mt-1 text-2xl font-bold text-red-700">
            {summary.failed}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">ユニークIP</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">
            {summary.uniqueIps}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Event type */}
          <div>
            <label
              htmlFor="event-type"
              className="mb-1 block text-xs font-medium text-neutral-600"
            >
              イベントタイプ
            </label>
            <select
              id="event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div>
            <label
              htmlFor="from-date"
              className="mb-1 block text-xs font-medium text-neutral-600"
            >
              開始日
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* To date */}
          <div>
            <label
              htmlFor="to-date"
              className="mb-1 block text-xs font-medium text-neutral-600"
            >
              終了日
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Failure only */}
          <div className="flex items-center gap-2">
            <input
              id="failure-only"
              type="checkbox"
              checked={failureOnly}
              onChange={(e) => setFailureOnly(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="failure-only"
              className="text-sm text-neutral-700"
            >
              失敗のみ表示
            </label>
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="rounded-md bg-neutral-800 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
          >
            {loading ? "検索中..." : "検索"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 font-medium text-neutral-600">
                日時
              </th>
              <th className="px-4 py-3 font-medium text-neutral-600">
                イベント
              </th>
              <th className="px-4 py-3 font-medium text-neutral-600">
                Actor
              </th>
              <th className="px-4 py-3 font-medium text-neutral-600">
                IPアドレス
              </th>
              <th className="px-4 py-3 font-medium text-neutral-600">
                User Agent
              </th>
              <th className="px-4 py-3 font-medium text-neutral-600">
                パス
              </th>
              <th className="px-4 py-3 font-medium text-neutral-600">
                Status
              </th>
              <th className="px-4 py-3 font-medium text-neutral-600">
                失敗理由
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-neutral-500"
                >
                  読み込み中...
                </td>
              </tr>
            )}
            {!loading && data && data.entries.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-neutral-500"
                >
                  該当する監査ログがありません
                </td>
              </tr>
            )}
            {data &&
              data.entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-neutral-100 hover:bg-neutral-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getEventBadgeColor(
                        entry.event_type
                      )}`}
                    >
                      {entry.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {entry.actor || "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-600">
                    {entry.ip_address || "-"}
                  </td>
                  <td
                    className="max-w-[200px] truncate px-4 py-3 text-xs text-neutral-500"
                    title={entry.user_agent}
                  >
                    {truncateUserAgent(entry.user_agent)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-600">
                    {entry.path || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                        entry.status_code >= 200 && entry.status_code < 300
                          ? "bg-green-100 text-green-700"
                          : entry.status_code >= 400
                            ? "bg-red-100 text-red-700"
                            : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {entry.status_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600">
                    {entry.failure_reason || "-"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {data.total > 0
              ? `${offset + 1} - ${Math.min(offset + PAGE_LIMIT, data.total)} / ${data.total} 件`
              : "0 件"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={offset === 0 || loading}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              前へ
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={
                !data || offset + PAGE_LIMIT >= data.total || loading
              }
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </>
  );
}
