import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ============================================================
  // Cache Components (PPR) — 有効化済み
  // ============================================================
  // 前提条件 (すべて満たされていることを確認済み):
  //   1. microCMS 実データへの完全移行が完了 ✅
  //   2. モックデータ内の new Date() 依存を全て排除 ✅
  //   3. cacheComponents: true で next build が成功 ✅
  //
  // モックデータは静的日時文字列を使用。
  // sitemap.ts は固定日時を使用。
  // 動的データ (API routes / Suspense 内) は build 時にはキャッシュされない。
  // ============================================================
  cacheComponents: true,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.microcms-assets.io' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default nextConfig;
