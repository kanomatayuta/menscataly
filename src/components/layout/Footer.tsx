import Link from "next/link";

const FOOTER_LINKS = {
  カテゴリ: [
    { label: "AGA治療", href: "/articles?category=aga" },
    { label: "医療脱毛", href: "/articles?category=hair-removal" },
    { label: "メンズスキンケア", href: "/articles?category=skincare" },
    { label: "ED治療", href: "/articles?category=ed" },
  ],
  サイト情報: [
    { label: "メンズカタリについて", href: "/about" },
    { label: "監修者紹介", href: "/supervisors" },
    { label: "お問い合わせ", href: "/contact" },
  ],
  法的情報: [
    { label: "プライバシーポリシー", href: "/privacy" },
    { label: "免責事項", href: "/disclaimer" },
    { label: "広告掲載ポリシー", href: "/advertising-policy" },
  ],
} as const;

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer
      className="border-t border-neutral-200 bg-neutral-900"
      aria-label="フッター"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* サイト説明 */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1"
            aria-label="メンズカタリ トップページ"
          >
            <span className="text-xl font-bold tracking-tight text-white">
              MENS
            </span>
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--color-accent-500, #c8a951)" }}
            >
              CATALY
            </span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。専門医監修のもと、信頼性の高いコンテンツを提供しています。
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            ※
            本サイトの情報は医療診断を代替するものではありません。症状について不安のある方は、必ず医師にご相談ください。
          </p>
        </div>

        {/* フッターリンク */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <nav key={category} aria-label={`${category}リンク`}>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-300">
                {category}
              </h2>
              <ul className="space-y-2" role="list">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* コピーライト */}
        <div className="mt-10 border-t border-neutral-700 pt-8">
          <p className="text-center text-xs text-neutral-500">
            &copy; {CURRENT_YEAR} メンズカタリ. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
