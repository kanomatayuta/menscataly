"use client";

import Script from "next/script";

interface AspTrackingScriptsProps {
  aspNames: string[];
  category: string;
}

/**
 * ASP tracking script URL mappings (placeholders).
 * In production, these would be loaded from ASP config / environment variables.
 */
const ASP_SCRIPT_URLS: Record<string, string> = {
  afb: "https://track.affiliate-b.com/js/tracking.js",
  a8: "https://px.a8.net/a8/tracking.js",
  accesstrade: "https://h.accesstrade.net/js/nct/n.js",
  valuecommerce: "https://aml.valuecommerce.com/vcdal.js",
  felmat: "https://t.felmat.net/js/tracking.js",
};

export function AspTrackingScripts({
  aspNames,
  category,
}: AspTrackingScriptsProps) {
  return (
    <>
      {aspNames.map((aspName) => {
        const scriptUrl = ASP_SCRIPT_URLS[aspName];
        if (!scriptUrl) return null;

        return (
          <Script
            key={aspName}
            src={scriptUrl}
            strategy="lazyOnload"
            data-asp={aspName}
            data-category={category}
          />
        );
      })}
    </>
  );
}
