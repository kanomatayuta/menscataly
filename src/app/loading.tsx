/**
 * グローバルローディングコンポーネント
 *
 * ページ遷移時にスケルトンUIを表示する。
 * レイアウト構造（ヒーロー＋カードグリッド）に合わせたプレースホルダー。
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="読み込み中">
      {/* ヒーロースケルトン */}
      <div
        className="py-16 sm:py-24"
        style={{ backgroundColor: "var(--color-primary-50, #eef2f8)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-64 rounded bg-neutral-200 sm:h-10 sm:w-96" />
            <div className="h-4 w-48 rounded bg-neutral-200 sm:w-80" />
            <div className="mt-4 h-10 w-32 rounded-md bg-neutral-200" />
          </div>
        </div>
      </div>

      {/* コンテンツスケルトン */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* セクションタイトル */}
        <div className="mb-8 h-7 w-40 rounded bg-neutral-200" />

        {/* カードグリッドスケルトン */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
            >
              {/* サムネイルスケルトン */}
              <div className="aspect-video bg-neutral-200" />
              {/* テキストスケルトン */}
              <div className="space-y-3 p-4">
                <div className="h-3 w-16 rounded bg-neutral-200" />
                <div className="h-5 w-full rounded bg-neutral-200" />
                <div className="h-4 w-3/4 rounded bg-neutral-200" />
                <div className="h-3 w-24 rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
