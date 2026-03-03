"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { BatchProgressBar } from "@/components/admin/BatchProgressBar";
import type { BatchJobStatus } from "@/types/admin";

// ------------------------------------------------------------------
// Categories available for batch generation
// ------------------------------------------------------------------

const CATEGORIES = [
  { id: "aga", label: "AGA Treatment" },
  { id: "hair-removal", label: "Hair Removal" },
  { id: "skincare", label: "Skincare" },
  { id: "ed", label: "ED Treatment" },
] as const;

// ------------------------------------------------------------------
// Mock history data
// ------------------------------------------------------------------

interface BatchHistoryItem {
  id: string;
  status: BatchJobStatus;
  totalKeywords: number;
  completedCount: number;
  failedCount: number;
  startedAt: string;
  completedAt: string | null;
  totalCostUsd: number;
}

const MOCK_HISTORY: BatchHistoryItem[] = [
  {
    id: "batch-001",
    status: "completed",
    totalKeywords: 10,
    completedCount: 10,
    failedCount: 0,
    startedAt: "2026-03-01T14:00:00+09:00",
    completedAt: "2026-03-01T15:30:00+09:00",
    totalCostUsd: 2.85,
  },
  {
    id: "batch-002",
    status: "completed",
    totalKeywords: 15,
    completedCount: 13,
    failedCount: 2,
    startedAt: "2026-03-02T10:00:00+09:00",
    completedAt: "2026-03-02T11:45:00+09:00",
    totalCostUsd: 3.64,
  },
  {
    id: "batch-003",
    status: "failed",
    totalKeywords: 5,
    completedCount: 2,
    failedCount: 3,
    startedAt: "2026-03-02T16:00:00+09:00",
    completedAt: "2026-03-02T16:20:00+09:00",
    totalCostUsd: 0.52,
  },
];

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminBatchPage() {
  // Form state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [dryRun, setDryRun] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  // Progress state
  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    status: BatchJobStatus;
    total: number;
    completed: number;
    failed: number;
  } | null>(null);

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId],
    );
  };

  const pollProgress = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/batch/${jobId}/progress`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("adminApiKey") ?? ""}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveJob({
          jobId: data.jobId,
          status: data.status,
          total: data.totalKeywords,
          completed: data.completedCount,
          failed: data.failedCount,
        });
        if (data.status === "running" || data.status === "queued") {
          // Continue polling
          return true;
        }
      }
    } catch {
      // Polling failed, stop
    }
    return false;
  }, []);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== "running" && activeJob.status !== "queued")) {
      return;
    }

    const interval = setInterval(async () => {
      const shouldContinue = await pollProgress(activeJob.jobId);
      if (!shouldContinue) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJob, pollProgress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage("");

    if (selectedCategories.length === 0) {
      setFormMessage("Please select at least one category.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("adminApiKey") ?? ""}`,
        },
        body: JSON.stringify({
          categories: selectedCategories,
          maxConcurrent,
          dryRun,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveJob({
          jobId: data.jobId,
          status: "running",
          total: data.totalKeywords ?? selectedCategories.length * 5,
          completed: 0,
          failed: 0,
        });
        setFormMessage("Batch generation started.");
      } else {
        setFormMessage(`Failed to start batch generation (${res.status}).`);
      }
    } catch {
      setFormMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Batch Generation"
        breadcrumbs={[{ label: "Batch" }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Start batch form */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Start Batch
          </h2>
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
          >
            {/* Category checkboxes */}
            <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-medium text-neutral-700">
                Categories
              </legend>
              <div className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2 text-sm text-neutral-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Max concurrent */}
            <div className="mb-4">
              <label
                htmlFor="max-concurrent"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Max Concurrent
              </label>
              <input
                id="max-concurrent"
                type="number"
                min={1}
                max={10}
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>

            {/* Dry run toggle */}
            <label className="mb-4 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              Dry run (no actual generation)
            </label>

            {formMessage && (
              <p className="mb-3 text-sm text-neutral-600" role="status">
                {formMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting
                ? "Starting..."
                : dryRun
                  ? "Start Dry Run"
                  : "Start Batch Generation"}
            </button>
          </form>
        </div>

        {/* Progress section */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Progress
          </h2>
          {activeJob ? (
            <BatchProgressBar
              completed={activeJob.completed}
              total={activeJob.total}
              failed={activeJob.failed}
              status={activeJob.status}
            />
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
              <p className="text-sm text-neutral-500">
                No active batch generation
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History section */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          History
        </h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Job ID
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Keywords
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Result
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Cost
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {MOCK_HISTORY.map((job) => {
                const statusStyles: Record<string, string> = {
                  completed: "bg-green-100 text-green-700",
                  failed: "bg-red-100 text-red-700",
                  running: "bg-blue-100 text-blue-700",
                  queued: "bg-neutral-100 text-neutral-700",
                  cancelled: "bg-neutral-100 text-neutral-700",
                };
                return (
                  <tr key={job.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {job.id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[job.status] ?? statusStyles.queued}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {job.totalKeywords}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {job.completedCount} done
                      {job.failedCount > 0 && (
                        <span className="ml-1 text-red-600">
                          / {job.failedCount} failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      ${job.totalCostUsd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {new Date(job.startedAt).toLocaleString("ja-JP")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
