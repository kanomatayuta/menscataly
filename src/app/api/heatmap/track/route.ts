import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/admin/rate-limit";

/**
 * POST /api/heatmap/track
 * ヒートマップイベントをバッチ保存する (クリック位置 + スクロール深度)
 * サーバー側バリデーション強化版
 */

interface HeatmapEvent {
  article_slug: string;
  event_type: "click" | "scroll";
  x_pct?: number;
  y_pct?: number;
  scroll_depth?: number;
  viewport_width?: number;
}

/** 値を0-100にクランプ */
function clamp0to100(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
}

/** scroll_depthを10刻みに正規化 (10, 20, ..., 100) */
function normalizeScrollDepth(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  const band = Math.round(n / 10) * 10;
  return Math.max(10, Math.min(100, band));
}

/** viewport_widthをサニタイズ (0-10000) */
function sanitizeViewportWidth(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(10000, Math.round(n)));
}

export async function POST(req: NextRequest) {
  // レート制限 (DoS対策: 認証なしエンドポイント)
  const rateLimited = withRateLimit(req, 'public:heatmap')
  if (rateLimited) return rateLimited

  try {
    const body = await req.json();
    const events: HeatmapEvent[] = Array.isArray(body.events) ? body.events : [];

    if (events.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    // Validate and sanitize events (max 50 per batch)
    const validated = events
      .slice(0, 50)
      .filter(
        (e) =>
          typeof e.article_slug === "string" &&
          e.article_slug.length > 0 &&
          e.article_slug.length <= 200 &&
          (e.event_type === "click" || e.event_type === "scroll")
      );

    if (validated.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // Supabase未設定時は静かに成功を返す
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const { createServerSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createServerSupabaseClient();

    const rows = validated.map((e) => ({
      article_slug: e.article_slug,
      event_type: e.event_type,
      x_pct: e.event_type === "click" ? clamp0to100(e.x_pct) : 0,
      y_pct: e.event_type === "click" ? clamp0to100(e.y_pct) : 0,
      scroll_depth: e.event_type === "scroll" ? normalizeScrollDepth(e.scroll_depth) : 0,
      viewport_width: sanitizeViewportWidth(e.viewport_width),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("heatmap_events")
      .insert(rows);

    if (error) {
      console.error("[heatmap/track] Insert error:", error.message);
      return NextResponse.json({ ok: false, error: "Failed to save events" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error("[heatmap/track] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
