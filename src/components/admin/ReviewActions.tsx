"use client";

import { useState } from "react";

interface ReviewActionsProps {
  articleId: string;
  currentStatus: string;
}

export function ReviewActions({ articleId, currentStatus }: ReviewActionsProps) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleAction = async (action: "approved" | "rejected") => {
    setIsSubmitting(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/articles/${articleId}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            typeof window !== "undefined"
              ? sessionStorage.getItem("adminApiKey") ?? ""
              : ""
          }`,
        },
        body: JSON.stringify({
          status: action,
          reviewNotes: notes,
        }),
      });

      if (res.ok) {
        setStatus(action);
        setMessage(`Article ${action} successfully.`);
      } else {
        setMessage(`Failed to update article status. (${res.status})`);
      }
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-800">
        Review Actions
      </h3>

      <div className="mb-3">
        <p className="mb-1 text-xs text-neutral-500">
          Current status:{" "}
          <span className="font-medium capitalize text-neutral-700">
            {status}
          </span>
        </p>
      </div>

      <div className="mb-4">
        <label
          htmlFor={`review-notes-${articleId}`}
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Review Notes
        </label>
        <textarea
          id={`review-notes-${articleId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add review notes (optional)..."
          rows={3}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleAction("approved")}
          disabled={isSubmitting || status === "approved"}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => handleAction("rejected")}
          disabled={isSubmitting || status === "rejected"}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm text-neutral-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
