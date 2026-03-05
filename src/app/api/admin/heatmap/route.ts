import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";

/**
 * GET /api/admin/heatmap?slug=xxx
 * ヒートマップ集計データを返す (クリック座標 + スクロール深度分布)
 *
 * totalClicks: クリック総数（生イベント数）
 * totalScrollSessions: スクロール到達セッション推定数
 *   (10%深度の到達数 = ほぼ全訪問者が到達するため、セッション数の近似値)
 */

export interface HeatmapClickPoint {
  x: number; // 0-100
  y: number; // 0-100
  count: number;
}

export interface HeatmapScrollBand {
  depth: number; // 10, 20, ... 100
  count: number;
}

export interface HeatmapData {
  clicks: HeatmapClickPoint[];
  scrollBands: HeatmapScrollBand[];
  totalClicks: number;
  totalScrollSessions: number;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    await connection();
  } catch {
    return NextResponse.json(emptyData());
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(emptyData());
  }

  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createServerSupabaseClient();

    // 直近30日
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clickData } = await (supabase as any)
      .from("heatmap_events")
      .select("x_pct, y_pct")
      .eq("article_slug", slug)
      .eq("event_type", "click")
      .gte("created_at", since);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scrollData } = await (supabase as any)
      .from("heatmap_events")
      .select("scroll_depth")
      .eq("article_slug", slug)
      .eq("event_type", "scroll")
      .gte("created_at", since);

    // クリックポイントをグリッドに集約 (2%刻み)
    const gridSize = 2;
    const clickGrid = new Map<string, number>();

    if (clickData) {
      for (const row of clickData) {
        const gx = Math.round(row.x_pct / gridSize) * gridSize;
        const gy = Math.round(row.y_pct / gridSize) * gridSize;
        const key = `${gx},${gy}`;
        clickGrid.set(key, (clickGrid.get(key) ?? 0) + 1);
      }
    }

    const clicks: HeatmapClickPoint[] = [];
    for (const [key, count] of clickGrid) {
      const [x, y] = key.split(",").map(Number);
      clicks.push({ x, y, count });
    }

    // スクロール深度を10%バンドに集約
    const bandCounts = new Map<number, number>();

    if (scrollData) {
      for (const row of scrollData) {
        const band = Math.floor(row.scroll_depth / 10) * 10;
        if (band >= 10) {
          bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
        }
      }
    }

    const scrollBands: HeatmapScrollBand[] = [];
    for (let d = 10; d <= 100; d += 10) {
      scrollBands.push({ depth: d, count: bandCounts.get(d) ?? 0 });
    }

    // セッション推定 = 10%深度の到達数（ほぼ全訪問者が10%には到達する）
    const totalScrollSessions = bandCounts.get(10) ?? 0;

    const result: HeatmapData = {
      clicks,
      scrollBands,
      totalClicks: clickData?.length ?? 0,
      totalScrollSessions,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/heatmap] Error:", err);
    return NextResponse.json(emptyData());
  }
}

function emptyData(): HeatmapData {
  return {
    clicks: [],
    scrollBands: Array.from({ length: 10 }, (_, i) => ({ depth: (i + 1) * 10, count: 0 })),
    totalClicks: 0,
    totalScrollSessions: 0,
  };
}
