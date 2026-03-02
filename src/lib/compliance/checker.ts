/**
 * コンプライアンスチェッカー メインクラス
 * 薬機法第66条・67条 / 景表法 / ステマ規制 対応
 */

import agaDictionary from "./dictionaries/aga.json";
import hairRemovalDictionary from "./dictionaries/hair-removal.json";
import skincareDictionary from "./dictionaries/skincare.json";
import edDictionary from "./dictionaries/ed.json";
import commonDictionary from "./dictionaries/common.json";
import { checkPharmaceuticalLawPatterns, checkRequiredElements } from "./rules/pharmaceutical-law";
import { checkRepresentationLawPatterns } from "./rules/representation-law";
import { checkStealthMarketingPatterns } from "./rules/stealth-marketing";
import { hasPRDisclosure, insertPRDisclosure } from "./templates/pr-disclosure";
import type {
  Category,
  CheckerOptions,
  ComplianceResult,
  DictionaryFile,
  NGEntry,
  Violation,
} from "./types";

/** 否定・批判文脈を示すパターン（これらが後続する場合はhigh違反と判定しない） */
const NEGATION_CONTEXT_PATTERNS = [
  /とは言えません/,
  /とは言い切れません/,
  /という主張は/,
  /という誤解/,
  /という嘘/,
  /という虚偽/,
  /と言う人もいますが/,
  /と思うかもしれませんが/,
  /かどうかは個人差/,
];

/**
 * 文脈が否定・批判文脈かどうかを確認する
 */
function isNegationContext(text: string, position: number): boolean {
  const surrounding = text.slice(Math.max(0, position - 5), Math.min(text.length, position + 30));
  return NEGATION_CONTEXT_PATTERNS.some((p) => p.test(surrounding));
}

const DICTIONARIES: Record<string, DictionaryFile> = {
  aga: agaDictionary as DictionaryFile,
  hair_removal: hairRemovalDictionary as DictionaryFile,
  skincare: skincareDictionary as DictionaryFile,
  ed: edDictionary as DictionaryFile,
  common: commonDictionary as DictionaryFile,
};

/**
 * コンプライアンススコアを計算する
 * @param violations 違反リスト
 * @param missingItems 未記載必須項目
 * @returns 0-100 のスコア
 */
function calculateScore(violations: Violation[], missingItems: string[]): number {
  let score = 100;

  for (const v of violations) {
    if (v.severity === "high") score -= 20;
    else if (v.severity === "medium") score -= 10;
    else score -= 5;
  }

  score -= missingItems.length * 15;

  return Math.max(0, score);
}

/**
 * 辞書エントリに基づくNGワードチェック
 */
function checkDictionaryEntries(
  text: string,
  entries: NGEntry[],
  categoryId: string
): Violation[] {
  const violations: Violation[] = [];

  for (const entry of entries) {
    const escapedNG = entry.ng.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedNG, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      violations.push({
        id: `dict_${categoryId}_${entry.id}`,
        type: entry.reason.includes("景表法") ? "representation_law" : "pharmaceutical_law",
        severity: entry.severity,
        ngText: match[0],
        suggestedText: entry.ok,
        reason: entry.reason,
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
 * テキスト中のNG表現を修正テキストに置換する
 */
function applyFixes(text: string, violations: Violation[]): string {
  // 重複を排除し、後ろから順に置換（位置ズレ防止）
  const uniqueViolations = violations
    .filter((v) => v.ngText !== "(PR表記なし)")
    .sort((a, b) => b.position.start - a.position.start);

  let fixed = text;
  for (const v of uniqueViolations) {
    fixed =
      fixed.slice(0, v.position.start) +
      v.suggestedText +
      fixed.slice(v.position.end);
  }
  return fixed;
}

/**
 * ComplianceChecker クラス
 *
 * @example
 * ```ts
 * const checker = new ComplianceChecker();
 * const result = checker.check("確実に髪が生えるAGA治療クリニック", { categories: ["aga"] });
 * console.log(result.isCompliant); // false
 * console.log(result.violations[0].suggestedText); // "発毛を促進する効果が期待できる..."
 * ```
 */
export class ComplianceChecker {
  private options: Required<CheckerOptions>;

  constructor(options: CheckerOptions = {}) {
    this.options = {
      categories: options.categories ?? ["aga", "hair_removal", "skincare", "ed", "common"],
      autoFix: options.autoFix ?? false,
      strictMode: options.strictMode ?? false,
    };
  }

  /**
   * テキストのコンプライアンスチェックを実行する
   * @param text チェック対象のテキスト
   * @param options オプション（インスタンスオプションを上書き可能）
   */
  check(text: string, options?: Partial<CheckerOptions>): ComplianceResult {
    const effectiveOptions = { ...this.options, ...options };
    const allViolations: Violation[] = [];

    // 1. 辞書ベースのチェック（カテゴリ別）
    for (const category of effectiveOptions.categories) {
      const dict = DICTIONARIES[category];
      if (dict) {
        const dictViolations = checkDictionaryEntries(text, dict.entries, category);
        allViolations.push(...dictViolations);
      }
    }

    // 2. 薬機法パターンルールチェック
    const pharmViolations = checkPharmaceuticalLawPatterns(text);
    allViolations.push(...pharmViolations);

    // 3. 景表法パターンルールチェック
    const reprViolations = checkRepresentationLawPatterns(text);
    allViolations.push(...reprViolations);

    // 4. ステマ規制チェック
    const stealthViolations = checkStealthMarketingPatterns(text);
    allViolations.push(...stealthViolations);

    // 5a. 否定・批判文脈の違反はhigh→lowにダウングレード
    for (const v of allViolations) {
      if (v.severity === "high" && isNegationContext(text, v.position.start)) {
        v.severity = "low";
      }
    }

    // 5. 必須要素チェック（E-E-A-T）
    const missingItems = checkRequiredElements(text);

    // 6. strictModeでない場合はlow severityを除外
    const filteredViolations = effectiveOptions.strictMode
      ? allViolations
      : allViolations.filter((v) => v.severity !== "low");

    // 7. 修正テキストの生成
    const fixedText = applyFixes(text, filteredViolations);

    // 8. PR表記チェック
    const hasPR = hasPRDisclosure(text);

    // 9. スコア計算
    const score = calculateScore(filteredViolations, missingItems);

    return {
      isCompliant: filteredViolations.length === 0 && missingItems.length === 0,
      violations: filteredViolations,
      fixedText,
      hasPRDisclosure: hasPR,
      missingItems,
      score,
    };
  }

  /**
   * テキストを自動修正して返す
   * @param text 修正対象テキスト
   * @param addPRDisclosure PR表記を自動挿入するか
   */
  fix(text: string, addPRDisclosure = true): string {
    const result = this.check(text);
    let fixed = result.fixedText;

    if (addPRDisclosure && !result.hasPRDisclosure) {
      fixed = insertPRDisclosure(fixed, "affiliate_standard");
    }

    return fixed;
  }

  /**
   * 利用可能なカテゴリを取得する
   */
  getAvailableCategories(): Category[] {
    return Object.keys(DICTIONARIES) as Category[];
  }

  /**
   * 辞書エントリ数を取得する
   */
  getDictionaryStats(): Record<string, number> {
    return Object.fromEntries(
      Object.entries(DICTIONARIES).map(([key, dict]) => [key, dict.entries.length])
    );
  }
}

// デフォルトインスタンスのエクスポート
export const defaultChecker = new ComplianceChecker();
