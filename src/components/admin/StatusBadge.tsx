import type { ReviewStatus } from "@/types/admin";

interface StatusBadgeProps {
  status: ReviewStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft: { label: "下書き", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  pending: { label: "レビュー待ち", bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  revision: { label: "修正依頼", bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  approved: { label: "承認済み", bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  rejected: { label: "却下", bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  published: { label: "公開済み", bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
};

/** ステータスワークフロー表示順序 */
const WORKFLOW_ORDER: ReviewStatus[] = ["draft", "pending", "approved", "published"];

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeClasses = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

/** ステータスワークフロー進捗バー */
export function StatusWorkflow({ current }: { current: ReviewStatus }) {
  const currentIndex = WORKFLOW_ORDER.indexOf(
    current === "rejected" || current === "revision" ? "pending" : current
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">
        ワークフロー
      </h3>

      <div className="flex items-center justify-between">
        {WORKFLOW_ORDER.map((step, index) => {
          const config = STATUS_CONFIG[step];
          const isActive = step === current;
          const isPast = index < currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div key={step} className="flex items-center">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isActive
                      ? `${config.bg} ${config.text} ring-2 ring-offset-2 ${config.dot.replace("bg-", "ring-")}`
                      : isPast
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isPast ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium ${
                    isActive ? config.text : isFuture ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {config.label}
                </span>
              </div>

              {/* Connector line */}
              {index < WORKFLOW_ORDER.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-8 sm:w-12 ${
                    index < currentIndex ? "bg-green-300" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Show rejected/revision notice */}
      {(current === "rejected" || current === "revision") && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2">
          <StatusBadge status={current} size="sm" />
          <span className="text-xs text-orange-700">
            {current === "rejected"
              ? "記事が却下されました。修正後に再度レビューに提出してください。"
              : "修正が依頼されています。対応後に再度レビューに提出してください。"}
          </span>
        </div>
      )}
    </div>
  );
}
