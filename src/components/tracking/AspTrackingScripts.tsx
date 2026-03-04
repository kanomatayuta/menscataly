"use client";

import Script from "next/script";

interface AspTrackingScriptsProps {
  aspNames: string[];
  category: string;
}

/**
 * ASP ITP対応トラッキングスクリプト
 *
 * 各ASPの公式ITPトラッキングスクリプトを記事ページに挿入する。
 * Safari/Firefox のITP制限下でもCookie計測を維持するため、
 * サードパーティCookieの代替としてファーストパーティ計測を行う。
 *
 * メディアIDは環境変数から取得:
 *   NEXT_PUBLIC_A8_MEDIA_ID — A8.net メディアID
 */

/** A8メディアID (ビルド時にインライン化) */
const A8_MEDIA_ID = process.env.NEXT_PUBLIC_A8_MEDIA_ID ?? "";

interface AspScriptConfig {
  url: string;
  attributes: Record<string, string>;
  strategy: "lazyOnload" | "afterInteractive";
}

/** ASP別 ITPトラッキングスクリプト設定 */
const ASP_ITP_SCRIPTS: Record<string, AspScriptConfig> = {
  a8: {
    url: "https://statics.a8.net/a8sales/a8sales.js",
    attributes: A8_MEDIA_ID ? { "data-a8": A8_MEDIA_ID } : {},
    strategy: "afterInteractive",
  },
  afb: {
    url: "https://t.afi-b.com/ta.js",
    attributes: { "data-afb-mode": "itp" },
    strategy: "lazyOnload",
  },
  accesstrade: {
    url: "https://h.accesstrade.net/js/nct/nct.js",
    attributes: {},
    strategy: "afterInteractive",
  },
  valuecommerce: {
    url: "https://amd.c.yimg.jp/amd/vcsc/vc_bridge.js",
    attributes: {},
    strategy: "lazyOnload",
  },
  felmat: {
    url: "https://www.felmat.net/fmimg/fm.js",
    attributes: {},
    strategy: "afterInteractive",
  },
  moshimo: {
    url: "https://af.moshimo.com/af/r/result.js",
    attributes: {},
    strategy: "lazyOnload",
  },
};

export function AspTrackingScripts({
  aspNames,
  category,
}: AspTrackingScriptsProps) {
  return (
    <>
      {aspNames.map((aspName) => {
        const config = ASP_ITP_SCRIPTS[aspName];
        if (!config) return null;

        return (
          <Script
            key={aspName}
            src={config.url}
            strategy={config.strategy}
            data-asp={aspName}
            data-category={category}
            {...config.attributes}
          />
        );
      })}
    </>
  );
}
