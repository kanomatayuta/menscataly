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
];

/**
 * PR表記の欠如を検出する
 */
export function checkPRDisclosure(text: string): boolean {
  return PR_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(text));
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
  if (!checkPRDisclosure(text)) {
    violations.push({
      id: "stealth_missing_pr",
      type: "missing_pr_disclosure",
      severity: "high",
      ngText: "(PR表記なし)",
      suggestedText: "※本記事はアフィリエイト広告を含みます",
      reason: "ステマ規制：アフィリエイト広告記事にはPR表記が必須",
      position: { start: 0, end: 0 },
    });
  }

  return violations;
}
