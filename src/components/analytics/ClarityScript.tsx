"use client";

import Script from "next/script";

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

/**
 * Microsoft Clarity Script Component
 * 無料ヒートマップ + セッションリプレイ + dead/rage click検出
 * NEXT_PUBLIC_CLARITY_PROJECT_ID が設定されている場合のみレンダリング
 */
export function ClarityScript() {
  if (!CLARITY_PROJECT_ID) {
    return null;
  }

  return (
    <Script id="clarity-init" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window,document,"clarity","script","${CLARITY_PROJECT_ID}");
      `}
    </Script>
  );
}
