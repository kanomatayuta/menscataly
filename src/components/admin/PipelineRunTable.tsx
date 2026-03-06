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
  idle: { bg: "bg-slate-100", text: "text-slate-700" },
  running: { bg: "bg-blue-100", text: "text-blue-700" },
  success: { bg: "bg-green-100", text: "text-green-700" },
  failed: { bg: "bg-red-100", text: "text-red-700" },
  partial: { bg: "bg-amber-100", text: "text-amber-700" },
};

const STATUS_LABELS: Record<PipelineStatus, string> = {
  idle: "待機中",
  running: "実行中",
  success: "成功",
  failed: "失敗",
  partial: "一部失敗",
};

const TYPE_LABELS: Record<PipelineType, string> = {
  daily: "デイリー",
  manual: "手動",
  pdca: "PDCA",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分 ${remainingSeconds}秒`;
}

export function PipelineRunTable({ runs }: PipelineRunTableProps) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">実行履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 font-medium text-slate-600">実行ID</th>
            <th className="px-4 py-3 font-medium text-slate-600">種別</th>
            <th className="px-4 py-3 font-medium text-slate-600">ステータス</th>
            <th className="px-4 py-3 font-medium text-slate-600">開始時刻</th>
            <th className="px-4 py-3 font-medium text-slate-600">
              所要時間
            </th>
            <th className="px-4 py-3 font-medium text-slate-600">エラー</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((run) => {
            const style = STATUS_STYLES[run.status];
            return (
              <tr key={run.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {run.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {TYPE_LABELS[run.type] ?? run.type}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                  >
                    {STATUS_LABELS[run.status] ?? run.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(run.startedAt).toLocaleString("ja-JP")}
                </td>
                <td className="px-4 py-3 text-slate-500">
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
