"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * カスタムエラーページ
 *
 * ランタイムエラー発生時に表示される。
 * リトライボタンとホームへのリンクを提供する。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // エラーをログ出力（本番ではエラー追跡サービスに送信）
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 sm:py-24">
      {/* エラーアイコン */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--color-primary-50, #eef2f8)" }}
      >
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
          style={{ color: "var(--color-primary-500, #1a365d)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h1 className="mt-6 text-2xl font-bold text-neutral-900 sm:text-3xl">
        エラーが発生しました
      </h1>
      <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-neutral-600">
        申し訳ございません。予期しないエラーが発生しました。時間をおいて再度お試しいただくか、トップページにお戻りください。
      </p>

      {error.digest && (
        <p className="mt-2 text-xs text-neutral-400">
          エラーID: {error.digest}
        </p>
      )}

      {/* アクションボタン */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        {/* リトライボタン */}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{
            backgroundColor: "var(--color-primary-500, #1a365d)",
          }}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
            />
          </svg>
          もう一度試す
        </button>

        {/* ホームへのリンク */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-6 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
