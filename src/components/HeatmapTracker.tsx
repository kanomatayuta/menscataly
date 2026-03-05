"use client";

import { useEffect, useRef, useCallback } from "react";

interface HeatmapTrackerProps {
  articleSlug: string;
}

interface PendingEvent {
  article_slug: string;
  event_type: "click" | "scroll";
  x_pct?: number;
  y_pct?: number;
  scroll_depth?: number;
  viewport_width?: number;
}

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 30;

/** 既知のボットUser-Agentパターン */
const BOT_UA_PATTERNS = /bot|crawl|spider|slurp|mediapartners|headless|phantom|selenium|puppeteer|playwright|lighthouse|pagespeed|prerender/i;

/** ボット判定 (User-Agent + webdriver検出) */
function isBot(): boolean {
  try {
    if (BOT_UA_PATTERNS.test(navigator.userAgent)) return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((navigator as any).webdriver) return true;
  } catch {
    return true;
  }
  return false;
}

/** 値を0-100の範囲にクランプし、小数1桁に丸める */
function clampPct(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
}

/**
 * 記事ページに設置するヒートマップトラッカー
 * クリック位置 + スクロール深度を収集し、バッチでAPIに送信
 */
export function HeatmapTracker({ articleSlug }: HeatmapTrackerProps) {
  const bufferRef = useRef<PendingEvent[]>([]);
  const reachedDepthsRef = useRef<Set<number>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(() => {
    const events = bufferRef.current.splice(0, MAX_BATCH_SIZE);
    if (events.length === 0) return;

    const payload = JSON.stringify({ events });

    // sendBeacon for reliability (works during page unload)
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon("/api/heatmap/track", new Blob([payload], { type: "application/json" }));
      if (!sent) {
        // sendBeacon failed (payload too large or browser rejected) — fallback to fetch
        fetch("/api/heatmap/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } else {
      fetch("/api/heatmap/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // ボット除外
    if (isBot()) return;

    // 管理者は計測しない（管理画面アクセス時にlocalStorageにフラグが立つ）
    try {
      if (localStorage.getItem("menscataly_admin") === "1") return;
    } catch {}

    // 管理画面プレビュー（iframe）からのアクセスも除外
    const params = new URLSearchParams(window.location.search);
    if (params.has("notrack")) return;
    if (window.self !== window.top) return;

    const vw = window.innerWidth;

    // --- Click tracking ---
    const handleClick = (e: MouseEvent) => {
      const docHeight = document.documentElement.scrollHeight;
      const docWidth = document.documentElement.scrollWidth;
      if (docHeight === 0 || docWidth === 0) return;

      const x_pct = (e.pageX / docWidth) * 100;
      const y_pct = (e.pageY / docHeight) * 100;

      bufferRef.current.push({
        article_slug: articleSlug,
        event_type: "click",
        x_pct: clampPct(x_pct),
        y_pct: clampPct(y_pct),
        viewport_width: vw,
      });
    };

    // --- Scroll depth tracking (IntersectionObserver at 10% intervals) ---
    // センチネル要素を動的に配置し、コンテンツ変更時に再計算
    const sentinels: HTMLDivElement[] = [];
    let resizeObserver: ResizeObserver | null = null;

    const placeSentinels = () => {
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight === 0) return;

      for (const el of sentinels) {
        const pct = Number(el.dataset.depth);
        el.style.top = `${(pct / 100) * docHeight}px`;
      }
    };

    const docHeight = document.documentElement.scrollHeight;
    for (let pct = 10; pct <= 100; pct += 10) {
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.top = `${(pct / 100) * docHeight}px`;
      el.style.height = "1px";
      el.style.width = "1px";
      el.style.pointerEvents = "none";
      el.dataset.depth = String(pct);
      document.body.appendChild(el);
      sentinels.push(el);
    }

    // コンテンツ高さ変更時にセンチネル位置を再計算
    try {
      resizeObserver = new ResizeObserver(placeSentinels);
      resizeObserver.observe(document.body);
    } catch {
      // ResizeObserver unsupported — sentinels stay at initial position
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const depth = Number((entry.target as HTMLElement).dataset.depth);
          if (depth < 10 || depth > 100) continue;
          if (reachedDepthsRef.current.has(depth)) continue;
          reachedDepthsRef.current.add(depth);

          bufferRef.current.push({
            article_slug: articleSlug,
            event_type: "scroll",
            scroll_depth: depth,
            viewport_width: vw,
          });
        }
      },
      { threshold: 0 }
    );

    for (const el of sentinels) {
      observer.observe(el);
    }

    // --- Periodic flush ---
    flushTimerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);

    // --- Event listeners ---
    document.addEventListener("click", handleClick, { passive: true });

    // Flush on page hide (tab switch, navigation)
    const handleVisChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", handleVisChange);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", handleVisChange);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      for (const el of sentinels) {
        el.remove();
      }
      flush(); // final flush
    };
  }, [articleSlug, flush]);

  return null; // 非表示コンポーネント
}
