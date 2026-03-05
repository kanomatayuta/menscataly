"use client";

import { useState } from "react";
import type { ReviewStatus } from "@/types/admin";

interface ReviewActionsProps {
  articleId: string;
  currentStatus: ReviewStatus;
  onStatusChange?: (newStatus: ReviewStatus, comment: string) => void;
}

export function ReviewActions({ articleId, currentStatus, onStatusChange }: ReviewActionsProps) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ReviewStatus>(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleAction = async (action: "approved" | "rejected" | "revision" | "published") => {
    if (!notes.trim() && (action === "rejected" || action === "revision")) {
      setMessage("却下・修正依頼にはコメントが必要です。");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      // Map component action values to API-expected values
      const actionMap: Record<string, string> = {
        approved: "approve",
        rejected: "reject",
        revision: "revision",
        published: "published",
      };

      const res = await fetch(`/api/admin/articles/${articleId}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: actionMap[action] ?? action,
          notes,
        }),
      });

      if (res.ok) {
        setStatus(action);
        setNotes("");
        onStatusChange?.(action, notes);
        const actionLabels: Record<string, string> = {
          approved: "承認",
          rejected: "却下",
          revision: "修正依頼",
          published: "公開",
        };
        setMessage(`記事を${actionLabels[action]}しました。`);
      } else {
        setMessage(`ステータス更新に失敗しました。(${res.status})`);
      }
    } catch {
      setMessage("ネットワークエラーが発生しました。再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTerminal = status === "published";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-800">
        レビューアクション
      </h3>

      {isTerminal ? (
        <div className="rounded-md bg-blue-50 p-3">
          <p className="text-sm text-blue-700">
            この記事は公開済みです。ステータスの変更はできません。
          </p>
        </div>
      ) : (
        <>
          {/* Comment input */}
          <div className="mb-4">
            <label
              htmlFor={`review-notes-${articleId}`}
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              レビューコメント
            </label>
            <textarea
              id={`review-notes-${articleId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="レビューコメントを入力（却下・修正依頼時は必須）..."
              rows={4}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {/* Primary actions row */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAction("approved")}
                disabled={isSubmitting || status === "approved"}
                className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                承認
              </button>
              <button
                type="button"
                onClick={() => handleAction("revision")}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                修正依頼
              </button>
              <button
                type="button"
                onClick={() => handleAction("rejected")}
                disabled={isSubmitting || status === "rejected"}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                却下
              </button>
            </div>

            {/* Publish action (only if approved) */}
            {status === "approved" && (
              <button
                type="button"
                onClick={() => handleAction("published")}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                公開する
              </button>
            )}
          </div>

          {message && (
            <p
              className={`mt-3 text-sm ${
                message.includes("失敗") || message.includes("エラー") || message.includes("必要")
                  ? "text-red-600"
                  : "text-green-600"
              }`}
              role="status"
            >
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
