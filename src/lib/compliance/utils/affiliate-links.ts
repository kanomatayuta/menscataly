/**
 * アフィリエイトリンク処理ユーティリティ
 * ステマ規制対応: rel="sponsored" 属性の自動付与
 */

/**
 * アフィリエイトURLパターン（主要ASP対応）
 */
const AFFILIATE_URL_PATTERNS = [
  /af\.moshimo\.com/,
  /af\.b\.afl\.rakuten\.co\.jp/,
  /i\.r\.rakuten\.co\.jp/,
  /px\.a8\.net/,
  /h\.accesstrade\.net/,
  /ck\.jp\.ap\.valuecommerce\.com/,
  /click\.linksynergy\.com/,
  /afb\.jp/,
  /\?af_id=/,
  /\?aid=/,
  /\/click\?/,
  /affiliate/i,
  /\/aff\//,
];

/**
 * URLがアフィリエイトリンクかどうかを判定する
 */
function isAffiliateUrl(url: string): boolean {
  return AFFILIATE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * HTMLのアフィリエイトリンクに rel="sponsored" を付与し、
 * target="_blank" のリンクには noopener noreferrer を追加する
 *
 * @param html 処理対象のHTML文字列
 * @returns rel属性を付与したHTML文字列
 *
 * @example
 * ```ts
 * const html = '<a href="https://px.a8.net/click?aid=123">AGA治療</a>';
 * const processed = processAffiliateLinks(html);
 * // → '<a href="..." rel="sponsored noopener">AGA治療</a>'
 * ```
 */
export function processAffiliateLinks(html: string): string {
  // <a href="..."> タグをマッチ
  return html.replace(
    /<a\s([^>]*?)>/gi,
    (fullMatch, attrs) => {
      // href を取得
      const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
      if (!hrefMatch) return fullMatch;

      const href = hrefMatch[1];
      const isAffiliate = isAffiliateUrl(href);

      if (!isAffiliate) return fullMatch;

      // target="_blank" の有無を確認
      const hasTargetBlank = /target=["']_blank["']/i.test(attrs);

      // rel属性の処理
      const relMatch = attrs.match(/rel=["']([^"']*)["']/i);
      let newAttrs = attrs;

      if (relMatch) {
        // 既存のrel属性を更新
        const existingRel = relMatch[1];
        const relValues = new Set(existingRel.split(/\s+/));
        relValues.add("sponsored");
        if (hasTargetBlank) {
          relValues.add("noopener");
          relValues.add("noreferrer");
        }
        newAttrs = attrs.replace(
          /rel=["'][^"']*["']/i,
          `rel="${Array.from(relValues).join(" ")}"`
        );
      } else {
        // rel属性を新規追加
        const relValues = ["sponsored"];
        if (hasTargetBlank) {
          relValues.push("noopener", "noreferrer");
        }
        newAttrs = `${attrs} rel="${relValues.join(" ")}"`;
      }

      return `<a ${newAttrs}>`;
    }
  );
}
