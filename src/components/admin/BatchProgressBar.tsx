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
      barColor = "bg-neutral-400";
      statusColor = "text-neutral-600";
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">Progress</span>
        <span className={`text-sm font-semibold capitalize ${statusColor}`}>
          {status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-neutral-100">
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

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {completed} / {total} completed
        </span>
        {failed > 0 && (
          <span className="text-red-600">{failed} failed</span>
        )}
        <span>{percentage}%</span>
      </div>
    </div>
  );
}
