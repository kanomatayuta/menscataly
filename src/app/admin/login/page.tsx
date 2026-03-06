"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ------------------------------------------------------------------
// Login form (inner component, uses useSearchParams)
// ------------------------------------------------------------------

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  const MAX_FAILURES = 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate empty fields
    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (res.ok) {
        const redirectTo = searchParams.get("from") || "/admin";
        router.push(redirectTo);
        return;
      }

      // Handle error responses
      const newFailureCount = failureCount + 1;
      setFailureCount(newFailureCount);

      if (res.status === 429) {
        setError("ログイン試行回数の上限に達しました。しばらく時間をおいてから再度お試しください。");
      } else if (res.status === 401) {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else {
        setError("サーバーエラーが発生しました。しばらく時間をおいてから再度お試しください。");
      }
    } catch {
      const newFailureCount = failureCount + 1;
      setFailureCount(newFailureCount);
      setError("ネットワークエラーが発生しました。接続を確認してください。");
    } finally {
      setIsLoading(false);
    }
  };

  const remainingAttempts = MAX_FAILURES - failureCount;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* Email field */}
      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          autoComplete="email"
          autoFocus
          disabled={isLoading}
        />
      </div>

      {/* Password field */}
      <div className="mb-4">
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          パスワード
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワードを入力"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          autoComplete="current-password"
          disabled={isLoading}
        />
      </div>

      {/* Remember me checkbox */}
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          disabled={isLoading}
        />
        ログイン状態を保持する（30日間）
      </label>

      {/* Error message */}
      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      {/* Failure warning */}
      {failureCount >= 3 && remainingAttempts > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-700">
            あと{remainingAttempts}回の失敗でアクセスがブロックされます
          </p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {isLoading ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}

// ------------------------------------------------------------------
// Page component (with Suspense boundary for useSearchParams)
// ------------------------------------------------------------------

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            <span style={{ color: "#1a365d" }}>MENS</span>{" "}
            <span style={{ color: "#c8a951" }}>CATALY</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">Admin Login</p>
        </div>

        {/* Form with Suspense boundary */}
        <Suspense
          fallback={
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-slate-400">読み込み中...</span>
              </div>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
