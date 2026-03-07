import { Suspense } from "react";
import { collectSidebarBannerCreatives } from "@/lib/asp/banner-injector";
import type { ContentCategory } from "@/types/content";

/**
 * ASP発行HTMLからscriptタグを除去するサニタイズ関数
 */
function sanitizeBannerHtml(html: string): string {
  let sanitized = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<script\b[^>]*\/>/gi, "");
  sanitized = sanitized.replace(
    /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    ""
  );
  // javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:/gi, 'src="');
  // data: URLs (except safe images)
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*data:(?!image\/(?:png|jpeg|gif|webp))/gi, 'src="');
  // SVG内のscript
  sanitized = sanitized.replace(/<svg[\s\S]*?<\/svg>/gi, (match) => {
    return match.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  });
  return sanitized;
}

interface AdSidebarProps {
  category: string;
}

/**
 * 広告バナーを取得して表示する内部コンポーネント
 * 最大3枚のバナーを表示
 */
async function AdBannerSlots({ category }: { category: string }) {
  const validCategories: ContentCategory[] = [
    "aga",
    "hair-removal",
    "skincare",
    "ed",
    "column",
  ];
  const contentCategory = validCategories.includes(category as ContentCategory)
    ? (category as ContentCategory)
    : null;

  if (!contentCategory) return null;

  let bannerHtmls: string[];
  try {
    bannerHtmls = await collectSidebarBannerCreatives(contentCategory, 3);
  } catch {
    return null;
  }

  if (bannerHtmls.length === 0) return null;

  return (
    <>
      {bannerHtmls.map((html, i) => {
        const sanitized = sanitizeBannerHtml(html);
        const withLazy =
          i > 0
            ? sanitized.replace(
                /<img\b(?![^>]*loading=)/gi,
                '<img loading="lazy"'
              )
            : sanitized;
        return (
          <div
            key={i}
            className="ad-sidebar-slot"
            role="img"
            aria-label={`広告バナー ${i + 1}`}
            dangerouslySetInnerHTML={{ __html: withLazy }}
          />
        );
      })}
    </>
  );
}

/**
 * 広告専用右サイドバー (Server Component)
 *
 * デスクトップ (lg以上) で表示:
 * - sticky配置
 * - 最大3枚の広告バナー
 * - 300px幅
 */
export async function AdSidebar({ category }: AdSidebarProps) {
  return (
    <aside
      role="complementary"
      aria-label="広告"
      className="ad-sidebar hidden lg:block"
      data-ad="true"
      data-nosnippet=""
    >
      <div className="ad-sidebar-sticky">
        <Suspense fallback={null}>
          <AdBannerSlots category={category} />
        </Suspense>
      </div>
    </aside>
  );
}
