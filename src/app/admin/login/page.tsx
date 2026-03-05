"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }

    setIsLoading(true);

    try {
      // サーバーサイドでAPIキーを検証し、httpOnly Cookieを設定
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Authentication failed");
        return;
      }

      // クライアントサイドAPIコール用にsessionStorageにも保存
      // (Bearer tokenとしてfetchヘッダーに使用)
      sessionStorage.setItem("adminApiKey", apiKey.trim());

      // リダイレクト先を取得（ミドルウェアが ?from= を設定）
      const redirectTo = searchParams.get("from") || "/admin";
      router.push(redirectTo);
    } catch {
      setError("Failed to authenticate. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-4">
        <label
          htmlFor="api-key"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          API Key
        </label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your admin API key"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
          autoComplete="off"
          autoFocus
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: "#1a365d" }}
      >
        {isLoading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-900">
            <span style={{ color: "#1a365d" }}>MENS</span>{" "}
            <span style={{ color: "#c8a951" }}>CATALY</span>
          </h1>
          <p className="mt-2 text-sm text-neutral-500">Admin Login</p>
        </div>

        {/* Form (Suspense required for useSearchParams in App Router) */}
        <Suspense
          fallback={
            <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="animate-pulse">
                <div className="mb-4 h-4 w-16 rounded bg-neutral-200" />
                <div className="mb-4 h-10 rounded bg-neutral-100" />
                <div className="h-10 rounded bg-neutral-200" />
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
