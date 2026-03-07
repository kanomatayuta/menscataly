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
}

const DEFAULT_CONFIG: AutomationConfig = {
  dailyPipeline: true,
  pdcaBatch: true,
  autoRewrite: false,
};

const CONFIG_KEY = "automation_config";

async function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const { createServerSupabaseClient } = await import("@/lib/supabase/client");
  return createServerSupabaseClient();
}

export async function getAutomationConfig(): Promise<AutomationConfig> {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return DEFAULT_CONFIG;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("app_config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .limit(1)
      .single();

    if (error || !data) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(data.value as Partial<AutomationConfig>) };
  } catch {
    // app_config テーブルが存在しない場合もデフォルトを返す
    return DEFAULT_CONFIG;
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

  const config = await getAutomationConfig();
  return NextResponse.json(config);
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
    const body = (await request.json()) as Partial<AutomationConfig>;
    const newConfig: AutomationConfig = { ...DEFAULT_CONFIG, ...body };

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
        { error: "app_config table does not exist. Run migrations/004-app-config.sql" },
        { status: 500 }
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(newConfig);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}
