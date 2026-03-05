"use client";

import { useEffect } from "react";
import { trackEvent } from "@/components/analytics/GA4Script";

/**
 * アフィリエイトリンククリック計測コンポーネント
 * data-asp 属性を持つ <a> タグのクリックを検知し、GA4にカスタムイベントを送信する
 *
 * 送信イベント: affiliate_link_click
 * パラメータ: asp_name, program_id, article_category, click_text, page_path
 */
export function AffiliateClickTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>("a[data-asp]");
      if (!link) return;

      trackEvent("affiliate_link_click", {
        asp_name: link.dataset.asp ?? "",
        program_id: link.dataset.program ?? "",
        article_category: link.dataset.category ?? "",
        click_text: (link.textContent ?? "").slice(0, 100),
        page_path: window.location.pathname,
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
