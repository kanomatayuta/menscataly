import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
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

/**
 * 管理者レイアウト
 * サーバーサイドで認証チェックを行い、未認証の場合はログインページにリダイレクトする。
 * （ミドルウェアでの認証チェックに加えた二重防御）
 *
 * ログインページの場合は AdminLayoutShell（サイドバー）なしで描画する。
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-admin-pathname") || "";

  // ログインページはサイドバーなしでそのまま表示
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  // サーバーサイド認証チェック（ミドルウェアの二重防御）
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin-token")?.value;
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminToken || !adminApiKey || adminToken !== adminApiKey) {
    redirect("/admin/login");
  }

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
