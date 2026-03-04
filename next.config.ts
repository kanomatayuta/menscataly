import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ============================================================
  // Cache Components (PPR) — 現在は無効化中
  // ============================================================
  // 有効化の前提条件:
  //   1. microCMS 実データへの完全移行が完了していること
  //   2. モックデータ内の new Date() 依存が全て排除されていること
  //   3. cacheComponents: true に変更後、next build が成功すること
  //
  // microcms-js-sdk が内部で new Date() を呼び出しており、
  // Cache Components のビルド時レンダリングと非互換なため無効化中。
  // ============================================================
  cacheComponents: false,
};

export default nextConfig;
