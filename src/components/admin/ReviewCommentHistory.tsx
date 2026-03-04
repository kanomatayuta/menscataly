"use client";

import type { ReviewComment } from "@/types/admin";

interface ReviewCommentHistoryProps {
  comments: ReviewComment[];
}

const ACTION_STYLES: Record<ReviewComment["action"], { label: string; color: string; icon: string }> = {
  approve: { label: "承認", color: "text-green-700 bg-green-50 border-green-200", icon: "check" },
  reject: { label: "却下", color: "text-red-700 bg-red-50 border-red-200", icon: "x" },
  revision: { label: "修正依頼", color: "text-orange-700 bg-orange-50 border-orange-200", icon: "edit" },
  comment: { label: "コメント", color: "text-blue-700 bg-blue-50 border-blue-200", icon: "chat" },
};

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReviewCommentHistory({ comments }: ReviewCommentHistoryProps) {
  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">
          レビュー履歴
        </h3>
        <p className="text-sm text-neutral-400">レビュー履歴はありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-800">
        レビュー履歴
      </h3>

      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute top-0 left-3 h-full w-px bg-neutral-200" />

        {comments.map((comment) => {
          const style = ACTION_STYLES[comment.action];
          return (
            <div key={comment.id} className="relative flex gap-3 pl-1">
              {/* Timeline dot */}
              <div className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-neutral-400" />

              <div className={`flex-1 rounded-md border p-3 ${style.color}`}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">
                      {style.label}
                    </span>
                    <span className="text-xs opacity-70">
                      by {comment.author}
                    </span>
                  </div>
                  <time className="text-xs opacity-60">
                    {formatDateTime(comment.createdAt)}
                  </time>
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
