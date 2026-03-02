/**
 * 景品表示法（景表法）ルールエンジン
 * 不当景品類及び不当表示防止法 - 優良誤認・有利誤認・最大級表現対応
 */

import type { Violation, ViolationType, Severity } from "../types";

interface PatternRule {
  pattern: RegExp;
  type: ViolationType;
  severity: Severity;
  reason: string;
  suggestion: (match: string) => string;
}

/**
 * 景表法に基づく正規表現パターンルール
 */
const REPRESENTATION_LAW_PATTERNS: PatternRule[] = [
  // 最大級表現（根拠なき場合）
  {
    pattern: /(最安値|最低価格|一番安い)(?![（(].*調査)/g,
    type: "superlative",
    severity: "high",
    reason: "景表法：最安値表現には調査日時・条件の根拠明記が必要",
    suggestion: () => "調査時点での最安水準（調査日時・条件は記事内に明記）",
  },
  {
    pattern: /(No\.1|ナンバー1|ナンバーワン|1位)(?![（(].*調査)/g,
    type: "superlative",
    severity: "high",
    reason: "景表法：No.1表現には第三者調査による根拠明示が必要",
    suggestion: (match) => `${match}（※〇〇調査 YYYY年MM月実施）`,
  },
  {
    pattern: /(日本一|業界一|日本最大|業界最大|業界最多)(?![（(].*調査)/g,
    type: "superlative",
    severity: "high",
    reason: "景表法：最大級表現には客観的根拠が必要",
    suggestion: (match) => `${match.replace(/(一|最大|最多)/, "トップ水準")}（※〇〇調査 YYYY年MM月実施）`,
  },
  {
    pattern: /(世界一|世界最大|世界最高|グローバルNo\.1)(?![（(].*調査)/g,
    type: "superlative",
    severity: "high",
    reason: "景表法：世界規模の最大級表現には根拠が必要",
    suggestion: () => "世界トップ水準（※〇〇調査 YYYY年MM月実施）",
  },
  // 有利誤認（価格・条件）
  {
    pattern: /完全無料(?!（|\()/g,
    type: "representation_law",
    severity: "high",
    reason: "景表法：完全無料表現は条件がある場合に有利誤認となる",
    suggestion: () => "初回無料（※条件・対象範囲は公式サイト参照）",
  },
  {
    pattern: /今日(だけ|限り|のみ)の価格(?!（|\()/g,
    type: "representation_law",
    severity: "high",
    reason: "景表法：根拠のない期間限定表現による有利誤認禁止",
    suggestion: () => "YYYY年MM月DD日までの期間限定価格",
  },
  {
    pattern: /今すぐ申し込まないと(損|後悔)/g,
    type: "representation_law",
    severity: "medium",
    reason: "景表法：不当な購買圧力による消費者の判断妨害禁止",
    suggestion: () => "お早めにご検討ください（キャンペーン期間終了後は通常価格）",
  },
  // 優良誤認（品質・効果）
  {
    pattern: /\d+人中\d+人(が満足|に効果|が成功)(?![（(].*調査)/g,
    type: "representation_law",
    severity: "high",
    reason: "景表法：根拠のない統計表現による優良誤認禁止",
    suggestion: (match) => `${match}（※〇〇調査 YYYY年MM月、n=〇〇）`,
  },
  {
    pattern: /(医師|専門家|皮膚科医|医学博士)(が?絶対|が?全員|が?必ず)(おすすめ|推奨|支持)/g,
    type: "representation_law",
    severity: "high",
    reason: "景表法：根拠なき専門家の全員推薦表現による優良誤認禁止",
    suggestion: () => "多くの医師が推奨する治療法の一つです（※〇〇調査による）",
  },
];

/**
 * テキストに対して景表法パターンルールを適用する
 */
export function checkRepresentationLawPatterns(text: string): Violation[] {
  const violations: Violation[] = [];

  for (const rule of REPRESENTATION_LAW_PATTERNS) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      violations.push({
        id: `repr_pattern_${violations.length + 1}`,
        type: rule.type,
        severity: rule.severity,
        ngText: match[0],
        suggestedText: rule.suggestion(match[0]),
        reason: rule.reason,
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }
  }

  return violations;
}
