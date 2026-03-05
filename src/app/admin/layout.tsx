import type { Metadata } from "next";
import { headers } from "next/headers";
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
