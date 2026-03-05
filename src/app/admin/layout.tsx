import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { AdminLayoutShell } from "./AdminLayoutShell";

export const metadata: Metadata = {
  title: {
    default: "Admin | MENS CATALY",
    template: "%s | Admin | MENS CATALY",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // PPR対応: プリレンダリング時は headers()/connection() が例外を投げる
  // 管理画面はランタイム専用のため、プリレンダリング時はシェルのみ返す
  try {
    await connection();
  } catch {
    return <AdminLayoutShell>{children}</AdminLayoutShell>;
  }

  // ミドルウェアが設定した x-admin-pathname を読み取る
  const headersList = await headers();
  const pathname = headersList.get("x-admin-pathname") ?? "";

  // ログインページはセッション検証不要 (レイアウトシェルも不要)
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Supabase Auth セッション検証
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
