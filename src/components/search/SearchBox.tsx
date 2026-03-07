"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";

const CATEGORY_SUGGESTIONS = [
  { label: "AGA治療", query: "AGA" },
  { label: "医療脱毛", query: "脱毛" },
  { label: "スキンケア", query: "スキンケア" },
  { label: "ED治療", query: "ED" },
] as const;

const SEARCH_HISTORY_KEY = "menscataly_search_history";
const MAX_HISTORY = 5;

function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_HISTORY);
  } catch {
    // ignore
  }
  return [];
}

function addToSearchHistory(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const history = getSearchHistory().filter((h) => h !== query);
    history.unshift(query);
    localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY))
    );
  } catch {
    // ignore
  }
}

function removeFromSearchHistory(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const history = getSearchHistory().filter((h) => h !== query);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

type SearchBoxProps = {
  /** Auto-focus the input when rendered */
  autoFocus?: boolean;
  /** Callback when the user submits (optional, for closing overlays etc.) */
  onSubmit?: () => void;
  /** Additional class names for the outer wrapper */
  className?: string;
  /** Show search history and suggestions dropdown */
  showSuggestions?: boolean;
};

export function SearchBox({
  autoFocus = false,
  onSubmit,
  className = "",
  showSuggestions = true,
}: SearchBoxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [history, setHistory] = useState<string[]>(getSearchHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isFocused) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFocused]);

  const performSearch = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      addToSearchHistory(trimmed);
      setHistory(getSearchHistory());
      setIsFocused(false);
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      onSubmit?.();
    },
    [router, onSubmit]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      performSearch(query);
    },
    [query, performSearch]
  );

  const handleSuggestionClick = useCallback(
    (suggestionQuery: string) => {
      setQuery(suggestionQuery);
      performSearch(suggestionQuery);
    },
    [performSearch]
  );

  const handleRemoveHistory = useCallback(
    (e: React.MouseEvent, item: string) => {
      e.stopPropagation();
      removeFromSearchHistory(item);
      setHistory(getSearchHistory());
    },
    []
  );

  const showDropdown =
    showSuggestions && isFocused && (history.length > 0 || !query.trim());

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form
        role="search"
        aria-label="サイト内検索"
        onSubmit={handleSubmit}
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
            onFocus={() => setIsFocused(true)}
            placeholder="記事を検索..."
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
          />
        </div>
      </form>

      {/* Dropdown: History + Category Suggestions */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-neutral-200 bg-white shadow-lg">
          {/* Search History */}
          {history.length > 0 && (
            <div className="border-b border-neutral-100 px-3 py-2">
              <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-neutral-400">
                検索履歴
              </p>
              <ul role="list">
                {history.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <svg
                          className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="truncate">{item}</span>
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="ml-2 flex-shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                        onClick={(e) => handleRemoveHistory(e, item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRemoveHistory(
                              e as unknown as React.MouseEvent,
                              item
                            );
                          }
                        }}
                        aria-label={`${item}を履歴から削除`}
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Category Suggestions */}
          <div className="px-3 py-2">
            <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-neutral-400">
              カテゴリから探す
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <button
                  key={cat.query}
                  type="button"
                  className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-100"
                  onClick={() => handleSuggestionClick(cat.query)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
