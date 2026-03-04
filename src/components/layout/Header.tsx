"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { SearchBox } from "@/components/search/SearchBox";

const NAV_ITEMS = [
  { label: "AGA治療", href: "/articles?category=aga" },
  { label: "ED治療", href: "/articles?category=ed" },
  { label: "医療脱毛", href: "/articles?category=hair-removal" },
  { label: "スキンケア", href: "/articles?category=skincare" },
] as const;

const SECONDARY_NAV = [
  { label: "監修者紹介", href: "/supervisors" },
  { label: "運営情報", href: "/about" },
] as const;

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
    // Close mobile menu when search is toggled
    setIsMenuOpen(false);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  // Close search on Escape key
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  // Close search when clicking outside
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* ロゴ */}
          <Link
            href="/"
            className="flex items-center gap-2 focus-visible:outline-primary-500"
            aria-label="メンズカタリ トップページ"
          >
            <span
              className="text-xl font-bold tracking-tight text-primary-500"
              style={{ color: "var(--color-primary-500, #1a365d)" }}
            >
              MENS
            </span>
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--color-accent-500, #c8a951)" }}
            >
              CATALY
            </span>
          </Link>

          {/* デスクトップナビゲーション */}
          <nav aria-label="メインナビゲーション" className="hidden md:block">
            <ul className="flex items-center gap-1" role="list">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-offset-2"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              {/* セパレータ */}
              <li aria-hidden="true" className="mx-1 h-4 w-px bg-neutral-300" />
              {SECONDARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-md px-2 py-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-offset-2"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* 検索ボタン + モバイルハンバーガーボタン */}
          <div className="flex items-center gap-1">
            {/* 検索ボタン */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-offset-2"
              aria-label={isSearchOpen ? "検索を閉じる" : "検索を開く"}
              aria-expanded={isSearchOpen}
              aria-controls="header-search"
              onClick={toggleSearch}
            >
              {isSearchOpen ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              )}
            </button>

            {/* モバイルハンバーガーボタン */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-offset-2 md:hidden"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
              onClick={toggleMenu}
            >
              <span className="sr-only">
                {isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
              </span>
              {/* ハンバーガーアイコン */}
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 検索バー (トグル表示) */}
      {isSearchOpen && (
        <div
          id="header-search"
          ref={searchContainerRef}
          className="border-t border-neutral-200 bg-white px-4 py-3 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-xl">
            <Suspense fallback={null}>
              <SearchBox autoFocus onSubmit={closeSearch} />
            </Suspense>
          </div>
        </div>
      )}

      {/* モバイルメニュー */}
      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-neutral-200 md:hidden">
          <nav aria-label="モバイルナビゲーション">
            <ul className="space-y-1 px-4 pb-2 pt-2" role="list">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-md px-3 py-2 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* セカンダリリンク */}
            <div className="border-t border-neutral-100 px-4 pb-4 pt-2">
              <ul className="space-y-1" role="list">
                {SECONDARY_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                      onClick={closeMenu}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
