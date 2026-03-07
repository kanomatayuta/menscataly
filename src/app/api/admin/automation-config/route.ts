/**
 * GET/PUT /api/admin/automation-config
 * 自動化設定の取得・更新
 * Supabase の app_config テーブルに保存
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth, getAuthErrorStatus } from "@/lib/admin/auth";

export interface AutomationConfig {
  dailyPipeline: boolean;
  pdcaBatch: boolean;
  autoRewrite: boolean;
  enabledCategories: string[];
}

const DEFAULT_CONFIG: AutomationConfig = {
  dailyPipeline: false,
  pdcaBatch: false,
  autoRewrite: false,
  enabledCategories: ["aga", "hair-removal", "skincare", "ed", "column"],
};

const CONFIG_KEY = "automation_config";

async function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const { createServerSupabaseClient } = await import("@/lib/supabase/client");
  return createServerSupabaseClient();
}

/**
 * 自動化設定を取得する。
 *
 * Fail-safe 設計:
 * - DB接続失敗 / テーブル不在 / 値が不正 → DEFAULT_CONFIG (全OFF) を返す
 * - boolean フィールドは === true のみ許可（"true", 1 等の truthy 値は false 扱い）
 * - 型が不正な場合はフィールドごとにデフォルト(false)へフォールバック
 */
export async function getAutomationConfig(): Promise<AutomationConfig> {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return { ...DEFAULT_CONFIG };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("app_config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .limit(1)
      .single();

    if (error || !data) return { ...DEFAULT_CONFIG };

    const raw = data.value;

    // raw が object でなければデフォルトを返す
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      console.warn("[automation-config] Invalid config value type, returning defaults");
      return { ...DEFAULT_CONFIG };
    }

    // 厳密な型チェック: boolean === true のみ許可
    // string "true", number 1 等の truthy 値は false として扱う（Fail-safe）
    const strictBoolean = (value: unknown): boolean => value === true;

    const config: AutomationConfig = {
      dailyPipeline: strictBoolean(raw.dailyPipeline),
      pdcaBatch: strictBoolean(raw.pdcaBatch),
      autoRewrite: strictBoolean(raw.autoRewrite),
      enabledCategories: Array.isArray(raw.enabledCategories)
        ? raw.enabledCategories.filter((c: unknown): c is string => typeof c === "string")
        : [...DEFAULT_CONFIG.enabledCategories],
    };

    return config;
  } catch {
    // app_config テーブルが存在しない場合もデフォルト(全OFF)を返す
    return { ...DEFAULT_CONFIG };
  }
}

export async function ensureAppConfigTable(): Promise<boolean> {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;

    // テーブルが存在するかテスト
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("app_config")
      .select("key")
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    );
  }

  // テーブル存在チェック（フロントエンドに通知するため）
  const tableExists = await ensureAppConfigTable();
  if (!tableExists) {
    return NextResponse.json(
      { ...DEFAULT_CONFIG, tableExists: false },
      { status: 503 }
    );
  }

  const config = await getAutomationConfig();
  return NextResponse.json({ ...config, tableExists: true });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    // 許可されたフィールドのみを明示的に抽出（マスプロパティインジェクション防止）
    const sanitizedBody: Partial<AutomationConfig> = {};
    if (typeof body.dailyPipeline === "boolean") sanitizedBody.dailyPipeline = body.dailyPipeline;
    if (typeof body.pdcaBatch === "boolean") sanitizedBody.pdcaBatch = body.pdcaBatch;
    if (typeof body.autoRewrite === "boolean") sanitizedBody.autoRewrite = body.autoRewrite;
    if (Array.isArray(body.enabledCategories)) {
      sanitizedBody.enabledCategories = body.enabledCategories.filter(
        (c): c is string => typeof c === "string"
      );
    }
    const newConfig: AutomationConfig = { ...DEFAULT_CONFIG, ...sanitizedBody };

    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // テーブル存在チェック
    const tableExists = await ensureAppConfigTable();
    if (!tableExists) {
      console.error("[automation-config] app_config table does not exist");
      return NextResponse.json(
        { error: "app_config table does not exist. Run migrations/004-app-config.sql", tableExists: false },
        { status: 503 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("app_config")
      .upsert(
        { key: CONFIG_KEY, value: newConfig, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      console.error("[automation-config] Save error:", error.message);
      return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
    }

    return NextResponse.json(newConfig);
  } catch (err) {
    console.error("[automation-config] Error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
