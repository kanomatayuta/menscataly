"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

/**
 * Next.js クライアントナビゲーション時に GA4 page_view イベントを送信する
 * 初回ロードは GA4Script の gtag('config') で送信されるため、
 * pathname/searchParams の変更時のみ送信する
 */
export function GA4PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA4_MEASUREMENT_ID) return;
    if (typeof window.gtag !== "function") return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");

    window.gtag("config", GA4_MEASUREMENT_ID, {
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}
