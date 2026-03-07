"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface HeatmapClickPoint {
  x: number;
  y: number;
  count: number;
}

interface HeatmapScrollBand {
  depth: number;
  count: number;
}

interface HeatmapData {
  clicks: HeatmapClickPoint[];
  scrollBands: HeatmapScrollBand[];
  totalClicks: number;
  totalScrollSessions: number;
}

type ViewMode = "off" | "click" | "scroll";

interface HeatmapOverlayProps {
  slug: string;
  title: string;
}

// ------------------------------------------------------------------
// Canvas rendering helpers
// ------------------------------------------------------------------

/** Draw a single gaussian dot on the shadow canvas */
function drawGaussianPoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  intensity: number,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${Math.min(intensity, 1)})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Apply color gradient to the grayscale intensity map */
function colorize(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha === 0) continue;

    const t = alpha / 255;

    let r: number, g: number, b: number;
    if (t < 0.25) {
      const s = t / 0.25;
      r = 0;
      g = Math.round(s * 255);
      b = 255;
    } else if (t < 0.5) {
      const s = (t - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.round((1 - s) * 255);
    } else if (t < 0.75) {
      const s = (t - 0.5) / 0.25;
      r = Math.round(s * 255);
      g = 255;
      b = 0;
    } else {
      const s = (t - 0.75) / 0.25;
      r = 255;
      g = Math.round((1 - s) * 255);
      b = 0;
    }

    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = Math.round(t * 180);
  }

  ctx.putImageData(imageData, 0, 0);
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

/** スクロール到達率 — 帯状カラーマスクでプレビュー上に表示 */
function ScrollDepthOverlay({ bands, maxCount }: { bands: HeatmapScrollBand[]; maxCount: number }) {
  if (maxCount === 0) return null;

  // bands を depth 順にソート
  const sorted = [...bands].sort((a, b) => a.depth - b.depth);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {sorted.map((band, i) => {
        const reachRate = maxCount > 0 ? (band.count / maxCount) * 100 : 0;
        // 緑(高到達) → 黄 → 赤(低到達)
        const hue = Math.round((reachRate / 100) * 120);
        // 帯の上端 = 前のバンドのdepth（最初は0%）、下端 = このバンドのdepth
        const top = i === 0 ? 0 : sorted[i - 1].depth;
        const bottom = band.depth;
        const height = bottom - top;

        return (
          <div
            key={band.depth}
            className="absolute left-0 right-0"
            style={{
              top: `${top}%`,
              height: `${height}%`,
              backgroundColor: `hsl(${hue}, 70%, 50%)`,
              opacity: 0.18,
            }}
          >
            {/* 下端にラベル */}
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center"
              style={{ opacity: 1 / 0.18 }}
            >
              <div
                className="h-px flex-1"
                style={{ backgroundColor: `hsl(${hue}, 70%, 50%)`, opacity: 0.5 }}
              />
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none text-white shadow"
                style={{ backgroundColor: `hsl(${hue}, 65%, 42%)` }}
              >
                {band.depth}% 到達 {reachRate.toFixed(0)}%
              </span>
              <div
                className="h-px w-3"
                style={{ backgroundColor: `hsl(${hue}, 70%, 50%)`, opacity: 0.5 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** モード切替トグル */
function ModeToggle({
  mode,
  onChange,
  totalClicks,
  totalScrolls,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  totalClicks: number;
  totalScrolls: number;
}) {
  const buttons: { value: ViewMode; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      value: "off",
      label: "プレビュー",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      value: "click",
      label: "クリック",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      ),
      count: totalClicks,
    },
    {
      value: "scroll",
      label: "スクロール",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      ),
      count: totalScrolls,
    },
  ];

  return (
    <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
      {buttons.map((btn) => (
        <button
          key={btn.value}
          onClick={() => onChange(btn.value)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === btn.value
              ? "bg-neutral-900 text-white shadow-sm"
              : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
          }`}
        >
          {btn.icon}
          {btn.label}
          {btn.count !== undefined && btn.count > 0 && (
            <span className={`tabular-nums text-[10px] ${mode === btn.value ? "text-neutral-400" : "text-neutral-400"}`}>
              ({btn.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export function HeatmapOverlay({ slug, title }: HeatmapOverlayProps) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [mode, setMode] = useState<ViewMode>("off");
  const [loading, setLoading] = useState(true);
  const [iframeHeight, setIframeHeight] = useState(800);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch heatmap data
  useEffect(() => {
    fetch(`/api/admin/heatmap?slug=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then((d: HeatmapData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  // Auto-resize iframe to match content height (same-origin)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let resizeObserver: ResizeObserver | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const sync = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        const h = Math.max(
          doc.body?.scrollHeight ?? 0,
          doc.body?.offsetHeight ?? 0,
          doc.documentElement?.scrollHeight ?? 0,
          doc.documentElement?.offsetHeight ?? 0,
        );
        if (h > 100) setIframeHeight(h);
      } catch {
        // cross-origin — keep default
      }
    };

    const onLoad = () => {
      sync();
      let count = 0;
      pollTimer = setInterval(() => {
        sync();
        count++;
        if (count >= 10 && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }, 500);

      try {
        const body = iframe.contentDocument?.body;
        if (body) {
          resizeObserver = new ResizeObserver(sync);
          resizeObserver.observe(body);
        }
      } catch {
        // ignore
      }
    };

    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      if (pollTimer) clearInterval(pollTimer);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [slug]);

  // Draw heatmap on canvas
  const drawHeatmap = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || !data || mode !== "click") return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (data.clicks.length === 0) return;

    const maxCount = Math.max(...data.clicks.map((p) => p.count));
    const radius = Math.max(20, Math.min(40, width / 20));

    for (const point of data.clicks) {
      const px = (point.x / 100) * width;
      const py = (point.y / 100) * height;
      const intensity = (point.count / maxCount) * 0.8;
      drawGaussianPoint(ctx, px, py, radius, intensity);
    }

    colorize(ctx, width, height);
  }, [data, mode]);

  useEffect(() => {
    drawHeatmap();

    const handleResize = () => drawHeatmap();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawHeatmap]);

  const maxScrollCount = data?.scrollBands?.length
    ? Math.max(...data.scrollBands.map((b) => b.count), 1)
    : 1;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/80 px-4 py-2">
        {!loading && data ? (
          <ModeToggle
            mode={mode}
            onChange={setMode}
            totalClicks={data.totalClicks}
            totalScrolls={data.totalScrollSessions}
          />
        ) : (
          <div className="h-8" />
        )}
        <a
          href={`/articles/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          別タブ
        </a>
      </div>

      {/* Preview + heatmap overlay */}
      <div ref={containerRef} className="relative overflow-hidden" style={{ height: iframeHeight }}>
        <iframe
          ref={iframeRef}
          src={`/articles/${slug}?notrack=1`}
          title={title}
          className="w-full border-0"
          scrolling="no"
          style={{ height: iframeHeight, overflow: "hidden" }}
        />

        {/* Click heatmap canvas overlay */}
        {mode === "click" && data && data.totalClicks > 0 && (
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          />
        )}

        {/* Scroll depth overlay — 帯状カラーマスク */}
        {mode === "scroll" && data?.scrollBands?.length && data.totalScrollSessions > 0 && (
          <ScrollDepthOverlay bands={data.scrollBands} maxCount={maxScrollCount} />
        )}

        {/* データなし時のグレーマスク */}
        {mode === "click" && !loading && data && data.totalClicks === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-neutral-500/30">
            <div className="flex h-full items-center justify-center">
              <div className="rounded-lg bg-white/90 px-5 py-3 shadow">
                <p className="text-sm font-medium text-neutral-600">クリックデータなし</p>
                <p className="mt-0.5 text-xs text-neutral-400">ユーザーのアクセスに応じて蓄積されます</p>
              </div>
            </div>
          </div>
        )}
        {mode === "scroll" && !loading && data && data.totalScrollSessions === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-neutral-500/30">
            <div className="flex h-full items-center justify-center">
              <div className="rounded-lg bg-white/90 px-5 py-3 shadow">
                <p className="text-sm font-medium text-neutral-600">スクロールデータなし</p>
                <p className="mt-0.5 text-xs text-neutral-400">ユーザーのアクセスに応じて蓄積されます</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
