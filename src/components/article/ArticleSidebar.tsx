import Link from "next/link";
import { SidebarTableOfContents } from "./SidebarTableOfContents";
import { getSupervisorsByCategory } from "@/lib/seo/supervisors-data";

interface ArticleSidebarProps {
  category: string;
  supervisorName?: string | null;
  supervisorCreds?: string | null;
}

/**
 * 左サイドバー (Server Component)
 *
 * デスクトップ (lg以上) で表示:
 * 1. Sticky目次 (SidebarTableOfContents) — h2常時表示、h3/h4/h5アコーディオン
 * 2. 監修者バッジ
 */
export async function ArticleSidebar({
  category,
  supervisorName,
  supervisorCreds,
}: ArticleSidebarProps) {
  // 監修者情報
  const supervisors = getSupervisorsByCategory(category);
  const supervisor = supervisors[0] ?? null;

  return (
    <aside
      role="complementary"
      aria-label="目次・監修者"
      className="left-sidebar hidden lg:block"
    >
      <div className="left-sidebar-sticky">
        {/* 1. 目次 (Sticky TOC) */}
        <SidebarTableOfContents />

        {/* 2. 監修者バッジ */}
        {(supervisorName || supervisor) && (
          <div className="sidebar-section">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                aria-hidden="true"
                style={{
                  backgroundColor: "var(--color-primary-100, #ccd8ec)",
                }}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: "var(--color-primary-500, #1a365d)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[0.65rem] text-neutral-500">監修者</p>
                <p className="text-xs font-semibold text-neutral-800 leading-tight">
                  {supervisorName ?? supervisor?.name}
                </p>
                {(supervisorCreds || supervisor?.credentials) && (
                  <p className="text-[0.65rem] text-neutral-500 leading-tight mt-0.5">
                    {supervisorCreds ?? supervisor?.credentials}
                  </p>
                )}
              </div>
            </div>
            {supervisor && (
              <Link
                href={`/supervisors/${supervisor.id}`}
                className="mt-2 block text-[0.7rem] text-primary-500 hover:text-primary-600 hover:underline"
              >
                プロフィールを見る
              </Link>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
