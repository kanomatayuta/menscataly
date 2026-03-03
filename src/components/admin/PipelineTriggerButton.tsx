"use client";

import { useState } from "react";

export function PipelineTriggerButton() {
  const [isTriggering, setIsTriggering] = useState(false);
  const [message, setMessage] = useState("");

  const handleTrigger = async () => {
    setIsTriggering(true);
    setMessage("");

    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            typeof window !== "undefined"
              ? sessionStorage.getItem("adminApiKey") ?? ""
              : ""
          }`,
        },
        body: JSON.stringify({ type: "manual" }),
      });

      if (res.ok) {
        setMessage("Pipeline triggered successfully");
      } else {
        setMessage(`Failed to trigger pipeline (${res.status})`);
      }
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className="text-xs text-neutral-500">{message}</span>
      )}
      <button
        type="button"
        onClick={handleTrigger}
        disabled={isTriggering}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isTriggering ? "Triggering..." : "Trigger Pipeline"}
      </button>
    </div>
  );
}
