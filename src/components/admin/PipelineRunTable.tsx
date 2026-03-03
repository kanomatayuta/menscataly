import type { PipelineStatus, PipelineType } from "@/lib/pipeline/types";

interface PipelineRun {
  id: string;
  type: PipelineType;
  status: PipelineStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

interface PipelineRunTableProps {
  runs: PipelineRun[];
}

const STATUS_STYLES: Record<PipelineStatus, { bg: string; text: string }> = {
  idle: { bg: "bg-neutral-100", text: "text-neutral-700" },
  running: { bg: "bg-blue-100", text: "text-blue-700" },
  success: { bg: "bg-green-100", text: "text-green-700" },
  failed: { bg: "bg-red-100", text: "text-red-700" },
  partial: { bg: "bg-amber-100", text: "text-amber-700" },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function PipelineRunTable({ runs }: PipelineRunTableProps) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">No pipeline runs found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-3 font-medium text-neutral-600">Run ID</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Type</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Started</th>
            <th className="px-4 py-3 font-medium text-neutral-600">
              Duration
            </th>
            <th className="px-4 py-3 font-medium text-neutral-600">Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {runs.map((run) => {
            const style = STATUS_STYLES[run.status];
            return (
              <tr key={run.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                  {run.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 capitalize text-neutral-600">
                  {run.type}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style.bg} ${style.text}`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {new Date(run.startedAt).toLocaleString("ja-JP")}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {formatDuration(run.durationMs)}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-red-600">
                  {run.error ?? "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
