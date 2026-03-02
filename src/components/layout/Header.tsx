"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "AGA治療", href: "/articles?category=aga" },
  { label: "医療脱毛", href: "/articles?category=hair-removal" },
  { label: "メンズスキンケア", href: "/articles?category=skincare" },
  { label: "ED治療", href: "/articles?category=ed" },
] as const;

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

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
            </ul>
          </nav>

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

      {/* モバイルメニュー */}
      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-neutral-200 md:hidden">
          <nav aria-label="モバイルナビゲーション">
            <ul className="space-y-1 px-4 pb-4 pt-2" role="list">
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
          </nav>
        </div>
      )}
    </header>
  );
}
