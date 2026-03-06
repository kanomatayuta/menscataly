interface BatchProgressBarProps {
  completed: number;
  total: number;
  failed: number;
  status: string;
}

export function BatchProgressBar({
  completed,
  total,
  failed,
  status,
}: BatchProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const failedPercentage = total > 0 ? Math.round((failed / total) * 100) : 0;

  const STATUS_LABELS: Record<string, string> = {
    running: "実行中",
    completed: "完了",
    failed: "失敗",
    cancelled: "キャンセル",
    queued: "待機中",
  };

  let barColor: string;
  let statusColor: string;
  switch (status) {
    case "running":
      barColor = "bg-blue-500";
      statusColor = "text-blue-700";
      break;
    case "completed":
      barColor = "bg-green-500";
      statusColor = "text-green-700";
      break;
    case "failed":
    case "cancelled":
      barColor = "bg-red-500";
      statusColor = "text-red-700";
      break;
    default:
      barColor = "bg-slate-400";
      statusColor = "text-slate-600";
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">進捗</span>
        <span className={`text-sm font-semibold ${statusColor}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* プログレスバー */}
      <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full">
          <div
            className={`h-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
          {failed > 0 && (
            <div
              className="h-full bg-red-400 transition-all duration-300"
              style={{ width: `${failedPercentage}%` }}
            />
          )}
        </div>
      </div>

      {/* 統計 */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {completed} / {total} 完了
        </span>
        {failed > 0 && (
          <span className="text-red-600">{failed} 失敗</span>
        )}
        <span>{percentage}%</span>
      </div>
    </div>
  );
}
