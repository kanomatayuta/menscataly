"use client";

import Script from "next/script";

/**
 * A8.net リンクマネージャー
 *
 * 提携済み広告主サイトへの直リンクを自動的にA8アフィリエイトリンクに変換する。
 * サイト全体の <head> に設置が必要。
 *
 * 機能:
 * 1. アフィリエイトリンク自動置換 — 提携広告主への直リンクをA8リンクに変換
 * 2. コンバージョンリファラ取得 — referrerpolicy を自動設定
 *
 * 環境変数: NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID
 */

const CONFIG_ID = process.env.NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID;

export function A8LinkManager() {
  if (!CONFIG_ID) return null;

  return (
    <>
      {/* A8 Link Manager SDK */}
      <Script
        id="a8-linkmgr-sdk"
        src="https://statics.a8.net/a8link/a8linkmgr.js"
        strategy="afterInteractive"
      />
      {/* 初期化 */}
      <Script
        id="a8-linkmgr-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `a8linkmgr({"config_id":"${CONFIG_ID}"});`,
        }}
      />
    </>
  );
}
