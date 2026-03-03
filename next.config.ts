import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // microCMS 実データ移行完了後に再有効化する
  // microcms-js-sdk が内部で new Date() を使用し Cache Components と非互換
  cacheComponents: false,
};

export default nextConfig;
