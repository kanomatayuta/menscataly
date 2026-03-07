/**
 * ステルスマーケティング規制ルールエンジン
 * 2023年10月施行 ステマ規制（景表法第5条第3号）対応
 */

import type { Violation } from "../types";

/**
 * PR表記・アフィリエイト開示の欠如チェック
 */
const PR_DISCLOSURE_PATTERNS = [
  /PR|広告|プロモーション|スポンサード|アフィリエイト|affiliate/i,
  /※本記事は.*(広告|PR|アフィリエイト)/,
  /本記事には.*(広告|PR|アフィリエイト)/,
  /プロモーション含む|広告を含む|PR含む/,
];

/**
 * ステマ疑い表現パターン（自然な口コミを装った広告表現）
 */
const STEALTH_MARKETING_SUSPICION_PATTERNS = [
  {
    pattern: /これはPR(では?ない|じゃない)/g,
    reason: "ステマ規制：広告であることの隠蔽表現禁止",
    suggestion: "※本記事はPR（広告）を含みます",
  },
  {
    pattern: /広告(では?ない|じゃない|ではありません)/g,
    reason: "ステマ規制：広告であることの隠蔽表現禁止",
    suggestion: "※本記事はアフィリエイト広告を含みます",
  },
  {
    pattern: /純粋な(口コミ|レビュー|体験談)です(?!.*(?:PR|広告|アフィリエイト))/g,
    reason: "ステマ規制：アフィリエイトを含む口コミの中立性偽装禁止",
    suggestion: "※本記事はアフィリエイト広告を含む口コミ・レビューです",
  },
  {
    pattern: /忖度なし(の|な|で)(口コミ|レビュー|評価)(?!.*(?:PR|広告|アフィリエイト))/g,
    reason: "ステマ規制：利益関係のある評価において忖度なしとの虚偽表現禁止",
    suggestion: "※本記事はアフィリエイト広告を含みます。筆者独自の評価を記載しています",
  },
  // --- C5: 新規追加パターン ---
  {
    pattern: /ステマ(では?ない|じゃない|ではありません)/g,
    reason: "ステマ規制：ステマ否定表現は逆効果であり、正しいPR表記が必要",
    suggestion: "※本記事はアフィリエイト広告を含みます",
  },
  {
    pattern: /案件(では?ない|じゃない|ではありません)/g,
    reason: "ステマ規制：広告案件の否定表現禁止",
    suggestion: "※本記事はアフィリエイト広告を含みます",
  },
  {
    pattern: /自腹(で|購入|レビュー)(?!.*(?:PR|広告|アフィリエイト))/g,
    reason: "ステマ規制：アフィリエイト収益がある場合の自腹強調は誤認を招く",
    suggestion: "※本記事にはアフィリエイト広告が含まれます。筆者が自費購入した上でレビューしています",
  },
  {
    pattern: /(?:メーカー|企業|会社).*(?:関係ない|関係ありません|無関係)(?!.*(?:PR|広告|アフィリエイト))/g,
    reason: "ステマ規制：アフィリエイト提携がある場合の無関係主張禁止",
    suggestion: "※本記事はアフィリエイト広告を含みます",
  },
  {
    pattern: /(?:お金|報酬|対価).*(?:もらって(?:い)?ない|受け取って(?:い)?ない)(?!.*(?:PR|広告|アフィリエイト))/g,
    reason: "ステマ規制：アフィリエイト報酬がある場合の報酬否定は虚偽表現",
    suggestion: "※本記事はアフィリエイト広告を含みます",
  },
];

/**
 * アフィリエイトURLパターン
 */
const AFFILIATE_URL_PATTERNS = [
  /px\.a8\.net/,
  /h\.accesstrade\.net/,
  /ck\.jp\.ap\.valuecommerce\.com/,
  /af\.moshimo\.com/,
  /afb\.jp/,
  /click\.linksynergy\.com/,
  /\?af_id=/,
  /\?aid=/,
  /\/aff\//,
];

/**
 * PR表記の欠如を検出する
 */
export function checkPRDisclosure(text: string): boolean {
  return PR_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * アフィリエイトリンクの密度をチェックする
 * 1000文字あたり3件を超える場合は警告を返す
 *
 * @param text チェック対象テキスト
 * @returns 警告違反（密度が高い場合）。問題ない場合は空配列
 */
export function checkLinkDensity(text: string): Violation[] {
  const violations: Violation[] = [];

  // マークダウンリンク [text](url) を抽出
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  let affiliateLinkCount = 0;
  let lastMatchIndex = 0;

  while ((match = linkPattern.exec(text)) !== null) {
    const url = match[2];
    if (AFFILIATE_URL_PATTERNS.some((p) => p.test(url))) {
      affiliateLinkCount++;
      lastMatchIndex = match.index;
    }
  }

  // HTMLリンク <a href="url"> も検出
  const htmlLinkPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlLinkPattern.exec(text)) !== null) {
    const url = match[1];
    if (AFFILIATE_URL_PATTERNS.some((p) => p.test(url))) {
      affiliateLinkCount++;
      lastMatchIndex = match.index;
    }
  }

  const textLength = text.length;
  const densityThreshold = 3; // per 1000 chars
  const normalizedCount = textLength > 0 ? (affiliateLinkCount / textLength) * 1000 : 0;

  if (normalizedCount > densityThreshold) {
    violations.push({
      id: "stealth_link_density",
      type: "stealth_marketing",
      severity: "medium",
      ngText: `アフィリエイトリンク ${affiliateLinkCount}件 (${normalizedCount.toFixed(1)}/1000文字)`,
      suggestedText: "アフィリエイトリンクの密度を下げ、1000文字あたり3件以下にしてください",
      reason: "ステマ規制：アフィリエイトリンクの過剰な挿入は広告色が強くなり、読者の信頼を損なう",
      position: { start: lastMatchIndex, end: lastMatchIndex },
    });
  }

  return violations;
}

/**
 * アフィリエイトリンクに rel="sponsored" が付与されているかチェックする
 *
 * @param html チェック対象のHTML文字列
 * @returns rel="sponsored" が欠如しているリンクの違反リスト
 */
export function checkRelSponsored(html: string): Violation[] {
  const violations: Violation[] = [];

  const linkPattern = /<a\s([^>]*?)>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const attrs = match[1];

    // href を取得
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    const url = hrefMatch[1];
    const isAffiliate = AFFILIATE_URL_PATTERNS.some((p) => p.test(url));
    if (!isAffiliate) continue;

    // rel="sponsored" の有無を確認
    const relMatch = attrs.match(/rel=["']([^"']+)["']/i);
    const hasSponsored = relMatch ? /sponsored/i.test(relMatch[1]) : false;

    if (!hasSponsored) {
      violations.push({
        id: `stealth_no_rel_sponsored_${violations.length + 1}`,
        type: "stealth_marketing",
        severity: "high",
        ngText: match[0],
        suggestedText: `${match[0].replace(/>$/, ' rel="sponsored noopener">')}`,
        reason: "ステマ規制：アフィリエイトリンクには rel=\"sponsored\" の付与が必須",
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }
  }

  return violations;
}

/**
 * ステマ疑い表現を検出する
 */
export function checkStealthMarketingPatterns(text: string): Violation[] {
  const violations: Violation[] = [];

  for (const rule of STEALTH_MARKETING_SUSPICION_PATTERNS) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      violations.push({
        id: `stealth_${violations.length + 1}`,
        type: "stealth_marketing",
        severity: "high",
        ngText: match[0],
        suggestedText: rule.suggestion,
        reason: rule.reason,
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }
  }

  // PR表記そのものが欠如している場合
  // アフィリエイトURLが含まれている場合のみ severity: "high"、それ以外は "low"
  if (!checkPRDisclosure(text)) {
    const hasAffiliateUrl = AFFILIATE_URL_PATTERNS.some((p) => p.test(text)) ||
      /affiliate|rel=["']sponsored/i.test(text);
    violations.push({
      id: "stealth_missing_pr",
      type: "missing_pr_disclosure",
      severity: hasAffiliateUrl ? "high" : "low",
      ngText: "(PR表記なし)",
      suggestedText: "※本記事はアフィリエイト広告を含みます",
      reason: "ステマ規制：アフィリエイト広告記事にはPR表記が必須",
      position: { start: 0, end: 0 },
    });
  }

  return violations;
}
