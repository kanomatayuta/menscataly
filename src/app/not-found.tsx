import Link from "next/link";

const RECOMMENDED_CATEGORIES = [
  { label: "AGA治療", href: "/articles?category=aga" },
  { label: "ED治療", href: "/articles?category=ed" },
  { label: "医療脱毛", href: "/articles?category=hair-removal" },
  { label: "スキンケア", href: "/articles?category=skincare" },
] as const;

/**
 * カスタム404ページ
 *
 * ブランドデザインに合わせた Not Found ページ。
 * トップページへのリンクとおすすめカテゴリへの導線を提供する。
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 sm:py-24">
      {/* 404 表示 */}
      <p
        className="text-6xl font-bold tracking-tight sm:text-8xl"
        style={{ color: "var(--color-primary-500, #1a365d)" }}
      >
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
        ページが見つかりません
      </h1>
      <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-neutral-600">
        お探しのページは移動または削除された可能性があります。URLをお確かめの上、再度お試しください。
      </p>

      {/* トップへのリンク */}
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
        style={{
          backgroundColor: "var(--color-primary-500, #1a365d)",
        }}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
        トップページに戻る
      </Link>

      {/* おすすめカテゴリ */}
      <div className="mt-12 w-full max-w-lg">
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-neutral-500">
          おすすめカテゴリ
        </h2>
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          role="list"
        >
          {RECOMMENDED_CATEGORIES.map((cat) => (
            <li key={cat.href}>
              <Link
                href={cat.href}
                className="block rounded-lg border border-neutral-200 bg-white p-3 text-center text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
              >
                {cat.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* 記事一覧リンク */}
      <p className="mt-8 text-sm text-neutral-500">
        または{" "}
        <Link
          href="/articles"
          className="font-medium underline underline-offset-4 transition-colors hover:text-neutral-900"
          style={{ color: "var(--color-primary-500, #1a365d)" }}
        >
          すべての記事を見る
        </Link>
      </p>
    </div>
  );
}
