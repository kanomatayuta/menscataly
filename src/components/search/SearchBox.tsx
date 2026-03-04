"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";

type SearchBoxProps = {
  /** Auto-focus the input when rendered */
  autoFocus?: boolean;
  /** Callback when the user submits (optional, for closing overlays etc.) */
  onSubmit?: () => void;
  /** Additional class names for the outer wrapper */
  className?: string;
};

export function SearchBox({
  autoFocus = false,
  onSubmit,
  className = "",
}: SearchBoxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      onSubmit?.();
    },
    [query, router, onSubmit]
  );

  return (
    <form
      role="search"
      aria-label="サイト内検索"
      onSubmit={handleSubmit}
      className={`relative w-full ${className}`}
    >
      <label htmlFor="search-input" className="sr-only">
        記事を検索
      </label>
      <div className="relative">
        {/* Search Icon */}
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          ref={inputRef}
          id="search-input"
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="記事を検索..."
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
        />
      </div>
    </form>
  );
}
