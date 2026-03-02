/**
 * 薬機法第66条・67条 ルールエンジン
 * 医薬品、医療機器等の品質、有効性及び安全性の確保等に関する法律
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
 * 薬機法第66条に基づく正規表現パターンルール
 * 辞書に含まれない汎用的なパターンをカバー
 */
const PHARMACEUTICAL_LAW_PATTERNS: PatternRule[] = [
  // 効果の断定表現
  {
    pattern: /必ず(効く|改善する|治る|発毛する|解消する|消える)/g,
    type: "pharmaceutical_law",
    severity: "high",
    reason: "薬機法第66条：効果の断定表現禁止",
    suggestion: (match) => match.replace(/必ず/, "").replace(/(効く|改善する|治る|発毛する|解消する|消える)/, "効果が期待できる"),
  },
  {
    pattern: /確実に(効く|改善する|治る|発毛する|解消する|消える|なくなる)/g,
    type: "pharmaceutical_law",
    severity: "high",
    reason: "薬機法第66条：確実性を示す断定表現禁止",
    suggestion: () => "効果が期待できる（個人差があります）",
  },
  {
    pattern: /\d+%の効果/g,
    type: "pharmaceutical_law",
    severity: "high",
    reason: "薬機法第66条：根拠なき数値による効果断定禁止",
    suggestion: (match) => `${match}（※〇〇試験・調査による）`,
  },
  // 副作用否定表現
  {
    pattern: /副作用(が?ない|なし|ゼロ|0)/g,
    type: "pharmaceutical_law",
    severity: "high",
    reason: "薬機法第66条：副作用の完全否定表現禁止",
    suggestion: () => "副作用のリスクが低いとされている（個人差があります）",
  },
  // 治癒・完治表現
  {
    pattern: /(完治|根治|完全回復|完全に治る|永久に治る)/g,
    type: "pharmaceutical_law",
    severity: "high",
    reason: "薬機法第66条：完治・根治の断定表現禁止",
    suggestion: () => "症状の改善が期待できる（個人差があります）",
  },
  // 即効性の断定
  {
    pattern: /即(効|座に)(効果|改善|治癒|発毛)/g,
    type: "pharmaceutical_law",
    severity: "medium",
    reason: "薬機法第66条：即効性の根拠なき断定禁止",
    suggestion: () => "早期の効果が期待できる場合があります（個人差があります）",
  },
  // 安全性の根拠なき断定
  {
    pattern: /(完全に安全|絶対に安全|100%安全)/g,
    type: "pharmaceutical_law",
    severity: "high",
    reason: "薬機法第66条：安全性の根拠なき断定禁止",
    suggestion: () => "安全性が確認されている（※医師の指導のもとで）",
  },
];

/**
 * テキストに対して薬機法パターンルールを適用する
 */
export function checkPharmaceuticalLawPatterns(text: string): Violation[] {
  const violations: Violation[] = [];

  for (const rule of PHARMACEUTICAL_LAW_PATTERNS) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      violations.push({
        id: `pharm_pattern_${violations.length + 1}`,
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

/**
 * PR・監修者情報・参考文献の必須要素チェック
 */
export function checkRequiredElements(text: string): string[] {
  const missing: string[] = [];

  if (!/(監修|監修者|医師監修|専門家監修)/.test(text)) {
    missing.push("監修者情報が未記載です（E-E-A-T対応必須）");
  }

  if (!/(参考文献|参考資料|出典|引用元)/.test(text)) {
    missing.push("参考文献・出典が未記載です（E-E-A-T対応必須）");
  }

  if (!/(更新日|最終更新|公開日)/.test(text)) {
    missing.push("更新日・公開日が未記載です（E-E-A-T対応必須）");
  }

  return missing;
}
