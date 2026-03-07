/**
 * GET /api/admin/categories
 * microCMS からカテゴリ一覧を取得
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth, getAuthErrorStatus } from "@/lib/admin/auth";
import { getCategories } from "@/lib/microcms/client";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    );
  }

  try {
    const result = await getCategories();
    const categories = result.contents.map((c) => ({
      id: c.slug ?? c.id,
      label: c.name,
    }));
    return NextResponse.json({ categories });
  } catch (err) {
    console.error("[admin/categories] Failed to fetch:", err);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
