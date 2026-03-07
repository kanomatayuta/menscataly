/**
 * コンプライアンスチェッカー メインクラス
 * 薬機法第66条・67条 / 景表法 / ステマ規制 対応
 */

import agaDictionary from "./dictionaries/aga.json";
import hairRemovalDictionary from "./dictionaries/hair-removal.json";
import skincareDictionary from "./dictionaries/skincare.json";
import edDictionary from "./dictionaries/ed.json";
import commonDictionary from "./dictionaries/common.json";
// Phase 2 拡張辞書
import agaTermsExtended from "./dictionaries/aga-terms";
import edTermsExtended from "./dictionaries/ed-terms";
import beautyTermsExtended from "./dictionaries/beauty-terms";
import priceTermsExtended from "./dictionaries/price-terms";
// Phase 3 拡張辞書
import comparisonTermsExtended from "./dictionaries/comparison-terms";
import supplementTermsExtended from "./dictionaries/supplement-terms";
import hairRemovalTermsExtended from "./dictionaries/hair-removal-terms";
import skincareTermsExtended from "./dictionaries/skincare-terms";
// Phase 4 拡張辞書
import agaTermsPhase4 from "./dictionaries/aga-terms-phase4";
import edTermsPhase4 from "./dictionaries/ed-terms-phase4";
import hairRemovalTermsPhase4 from "./dictionaries/hair-removal-terms-phase4";
import skincareTermsPhase4 from "./dictionaries/skincare-terms-phase4";
import commonTermsPhase4 from "./dictionaries/common-terms-phase4";
import { checkPharmaceuticalLawPatterns, checkRequiredElements } from "./rules/pharmaceutical-law";
import { checkRepresentationLawPatterns } from "./rules/representation-law";
import { checkStealthMarketingPatterns, checkRelSponsored, checkLinkDensity } from "./rules/stealth-marketing";
import { EEATValidator } from "./rules/eeat-validation";
import { hasPRDisclosure, insertPRDisclosure } from "./templates/pr-disclosure";
import type { Article } from "@/types/content";
import type {
  Category,
  CheckerOptions,
  ComplianceResult,
  DictionaryFile,
  NGEntry,
  Severity,
  Violation,
  ViolationType,
} from "./types";

// ============================================================
// バッチチェック・レポート生成 用の補助型
// ============================================================

/** バッチチェック結果（セクションインデックスと結果のペア） */
export interface BatchCheckResult {
  /** セクションインデックス（0始まり） */
  index: number;
  /** チェック対象テキストの先頭50文字（識別用） */
  preview: string;
  /** コンプライアンス結果 */
  result: ComplianceResult;
}

/** 違反タイプ別集計 */
export interface ViolationTypeSummary {
  type: ViolationType;
  count: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/** コンプライアンスレポート */
export interface ComplianceReport {
  /** チェック実施日時（ISO 8601） */
  checkedAt: string;
  /** チェックしたセクション数 */
  totalSections: number;
  /** 全体の準拠率（準拠セクション数 / 全セクション数 × 100） */
  complianceRate: number;
  /** 全体スコアの平均 */
  averageScore: number;
  /** 全違反の合計件数 */
  totalViolations: number;
  /** severity別の違反件数 */
  violationsBySeverity: Record<Severity, number>;
  /** 違反タイプ別集計 */
  violationsByType: ViolationTypeSummary[];
  /** 未記載必須項目の集計（重複除去） */
  missingItems: string[];
  /** 最も多く発生したNG表現 Top 5 */
  topNGExpressions: Array<{ ngText: string; count: number }>;
  /** PR表記が含まれているセクション数 */
  sectionsWithPRDisclosure: number;
  /** 個別チェック結果 */
  sectionResults: BatchCheckResult[];
}

/** 改善提案 */
export interface ContentSuggestion {
  /** 対象NGテキスト */
  ngText: string;
  /** 改善後テキスト */
  suggestedText: string;
  /** 違反理由 */
  reason: string;
  /** 重要度 */
  severity: Severity;
  /** 改善のポイント（ユーザー向け説明） */
  tip: string;
}

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

/**
 * 辞書エントリを結合するヘルパー
 * 同一カテゴリの既存辞書と拡張辞書のエントリをマージする
 */
function mergeDictionaries(base: DictionaryFile, ...extensions: DictionaryFile[]): DictionaryFile {
  const mergedEntries = [...base.entries];
  for (const ext of extensions) {
    mergedEntries.push(...ext.entries);
  }
  return {
    ...base,
    entries: mergedEntries,
  };
}

const DICTIONARIES: Record<string, DictionaryFile> = {
  aga: mergeDictionaries(agaDictionary as DictionaryFile, agaTermsExtended, agaTermsPhase4),
  hair_removal: mergeDictionaries(hairRemovalDictionary as DictionaryFile, hairRemovalTermsExtended, hairRemovalTermsPhase4),
  skincare: mergeDictionaries(skincareDictionary as DictionaryFile, skincareTermsExtended, skincareTermsPhase4),
  ed: mergeDictionaries(edDictionary as DictionaryFile, edTermsExtended, edTermsPhase4),
  supplement: supplementTermsExtended,
  common: mergeDictionaries(
    commonDictionary as DictionaryFile,
    beautyTermsExtended,
    priceTermsExtended,
    comparisonTermsExtended,
    commonTermsPhase4
  ),
};

/** severity別の減点上限（キャップ） */
const SCORE_DEDUCTION_CAPS: Record<Severity, number> = {
  high: 40,
  medium: 25,
  low: 15,
};

/** severity別の1件あたり減点 */
const SCORE_DEDUCTION_PER_VIOLATION: Record<Severity, number> = {
  high: 20,
  medium: 10,
  low: 5,
};

/** 必須項目欠如1件あたりの減点 */
const MISSING_ITEM_DEDUCTION = 10;

/**
 * コンプライアンススコアを計算する
 * severity別に減点上限（キャップ）を設け、違反集中によるスコア崩壊を防ぐ。
 * @param violations 違反リスト
 * @param missingItems 未記載必須項目
 * @returns 0-100 のスコア
 */
function calculateScore(violations: Violation[], missingItems: string[]): number {
  let score = 100;

  // severity別の合計減点を計算し、キャップを適用
  const deductionBySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 };

  for (const v of violations) {
    deductionBySeverity[v.severity] += SCORE_DEDUCTION_PER_VIOLATION[v.severity];
  }

  for (const severity of ["high", "medium", "low"] as Severity[]) {
    const capped = Math.min(deductionBySeverity[severity], SCORE_DEDUCTION_CAPS[severity]);
    score -= capped;
  }

  score -= missingItems.length * MISSING_ITEM_DEDUCTION;

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
  // severity の優先度マップ（高い方を残す）
  const severityPriority: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

  // 同一 position.start の重複を除去（severity が最も高いものだけ残す）
  const byStart = new Map<number, Violation>();
  for (const v of violations) {
    if (v.ngText === "(PR表記なし)") continue;
    const existing = byStart.get(v.position.start);
    if (!existing || severityPriority[v.severity] > severityPriority[existing.severity]) {
      byStart.set(v.position.start, v);
    }
  }

  // 後ろから順に置換（位置ズレ防止）
  const uniqueViolations = Array.from(byStart.values())
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
      categories: options.categories ?? ["aga", "hair_removal", "skincare", "ed", "supplement", "common"],
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

    // 4b. rel="sponsored" 欠如チェック
    const relSponsoredViolations = checkRelSponsored(text);
    allViolations.push(...relSponsoredViolations);

    // 4c. アフィリエイトリンク密度チェック
    const linkDensityViolations = checkLinkDensity(text);
    allViolations.push(...linkDensityViolations);

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

  /**
   * 複数テキスト（記事セクション等）の一括コンプライアンスチェックを実行する
   * @param sections チェック対象テキストの配列
   * @param options オプション（インスタンスオプションを上書き可能）
   * @returns セクションインデックスとチェック結果のペアの配列
   *
   * @example
   * ```ts
   * const checker = new ComplianceChecker();
   * const results = checker.batchCheck([
   *   "確実に髪が生えるAGA治療",
   *   "副作用のリスクが低いとされています",
   * ]);
   * results.forEach(({ index, result }) => {
   *   console.log(`Section ${index}: compliant=${result.isCompliant}`);
   * });
   * ```
   */
  batchCheck(sections: string[], options?: Partial<CheckerOptions>): BatchCheckResult[] {
    return sections.map((text, index) => ({
      index,
      preview: text.slice(0, 50).replace(/\n/g, " "),
      result: this.check(text, options),
    }));
  }

  /**
   * 複数のコンプライアンス結果からサマリーレポートを生成する
   * @param results ComplianceResult の配列（batchCheck の結果や個別チェック結果を渡す）
   * @returns コンプライアンスレポート
   *
   * @example
   * ```ts
   * const checker = new ComplianceChecker();
   * const batchResults = checker.batchCheck(sections);
   * const report = checker.generateReport(batchResults.map(r => r.result));
   * console.log(`準拠率: ${report.complianceRate}%`);
   * ```
   */
  generateReport(results: ComplianceResult[]): ComplianceReport {
    const now = new Date().toISOString();
    const totalSections = results.length;

    if (totalSections === 0) {
      return {
        checkedAt: now,
        totalSections: 0,
        complianceRate: 100,
        averageScore: 100,
        totalViolations: 0,
        violationsBySeverity: { high: 0, medium: 0, low: 0 },
        violationsByType: [],
        missingItems: [],
        topNGExpressions: [],
        sectionsWithPRDisclosure: 0,
        sectionResults: [],
      };
    }

    // 準拠セクション数
    const compliantSections = results.filter((r) => r.isCompliant).length;
    const complianceRate = Math.round((compliantSections / totalSections) * 100);

    // 平均スコア
    const averageScore = Math.round(
      results.reduce((sum, r) => sum + r.score, 0) / totalSections
    );

    // 全違反を平坦化
    const allViolations = results.flatMap((r) => r.violations);
    const totalViolations = allViolations.length;

    // severity別集計
    const violationsBySeverity: Record<Severity, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const v of allViolations) {
      violationsBySeverity[v.severity]++;
    }

    // 違反タイプ別集計
    const typeMap = new Map<ViolationType, { high: number; medium: number; low: number }>();
    for (const v of allViolations) {
      const existing = typeMap.get(v.type) ?? { high: 0, medium: 0, low: 0 };
      existing[v.severity]++;
      typeMap.set(v.type, existing);
    }
    const violationsByType: ViolationTypeSummary[] = Array.from(typeMap.entries()).map(
      ([type, counts]) => ({
        type,
        count: counts.high + counts.medium + counts.low,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
      })
    ).sort((a, b) => b.count - a.count);

    // 未記載必須項目の集計（重複除去）
    const missingItemsSet = new Set(results.flatMap((r) => r.missingItems));
    const missingItems = Array.from(missingItemsSet);

    // Top 5 NG表現
    const ngCountMap = new Map<string, number>();
    for (const v of allViolations) {
      if (v.ngText !== "(PR表記なし)") {
        ngCountMap.set(v.ngText, (ngCountMap.get(v.ngText) ?? 0) + 1);
      }
    }
    const topNGExpressions = Array.from(ngCountMap.entries())
      .map(([ngText, count]) => ({ ngText, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // PR表記を含むセクション数
    const sectionsWithPRDisclosure = results.filter((r) => r.hasPRDisclosure).length;

    // 個別チェック結果（sectionResults）はbatchCheckの結果から再構築
    const sectionResults: BatchCheckResult[] = results.map((result, index) => ({
      index,
      preview: `Section ${index + 1}`,
      result,
    }));

    return {
      checkedAt: now,
      totalSections,
      complianceRate,
      averageScore,
      totalViolations,
      violationsBySeverity,
      violationsByType,
      missingItems,
      topNGExpressions,
      sectionsWithPRDisclosure,
      sectionResults,
    };
  }

  /**
   * テキストの改善提案を生成する（getSuggestions 強化版）
   * 違反情報に加え、ユーザー向けの改善ティップスを付加する
   * @param text チェック対象テキスト
   * @param options オプション
   * @returns 改善提案リスト（severity降順）
   *
   * @example
   * ```ts
   * const checker = new ComplianceChecker();
   * const suggestions = checker.getSuggestions("確実に髪が生えるAGA治療");
   * suggestions.forEach(s => {
   *   console.log(`NG: ${s.ngText} → OK: ${s.suggestedText}`);
   *   console.log(`改善のポイント: ${s.tip}`);
   * });
   * ```
   */
  getSuggestions(text: string, options?: Partial<CheckerOptions>): ContentSuggestion[] {
    const result = this.check(text, { ...options, strictMode: true });

    /** severity をスコアに変換（ソート用） */
    const severityScore = (s: Severity): number =>
      s === "high" ? 3 : s === "medium" ? 2 : 1;

    /** 違反タイプ別のTipsテンプレート */
    const tipsTemplate: Record<ViolationType, string> = {
      pharmaceutical_law:
        "薬機法第66条対応: 効果・安全性の断定表現は「〜が期待できます」「個人差があります」等に変換してください。",
      representation_law:
        "景表法対応: 最大級・統計表現には調査日時・条件・根拠を必ず明記してください。",
      stealth_marketing:
        "ステマ規制対応: 記事冒頭にPR表記を挿入し、アフィリエイトリンクに rel=\"sponsored\" を付与してください。",
      superlative:
        "最大級表現対応: 「No.1」「最安値」等の表現には第三者調査の根拠・調査日時が必要です。",
      missing_pr_disclosure:
        "PR表記欠如: 記事の冒頭（本文より前）に「※本記事はアフィリエイト広告を含みます」等の表記を挿入してください。",
    };

    return result.violations
      .sort((a, b) => severityScore(b.severity) - severityScore(a.severity))
      .map((v) => ({
        ngText: v.ngText,
        suggestedText: v.suggestedText,
        reason: v.reason,
        severity: v.severity,
        tip: tipsTemplate[v.type] ?? "コンプライアンス違反が検出されました。修正テキストを参考に表現を変更してください。",
      }));
  }
  /**
   * テキストと記事データの両方を使ったコンプライアンスチェック（E-E-A-T スコアリング付き）
   *
   * 通常の check() に加え、Article データを使った E-E-A-T バリデーションを実行する。
   * check() の後方互換性を保ちつつ、記事データが利用可能な場合に拡張チェックを行う。
   *
   * @param text チェック対象テキスト
   * @param article 記事データ（E-E-A-T 評価用）
   * @param options オプション
   * @returns E-E-A-T スコアを含むコンプライアンス結果
   *
   * @example
   * ```ts
   * const checker = new ComplianceChecker();
   * const result = checker.checkWithArticle(article.content, article);
   * console.log(result.eeatScore?.total); // 75
   * ```
   */
  checkWithArticle(
    text: string,
    article: Article,
    options?: Partial<CheckerOptions>
  ): ComplianceResult {
    // 通常のコンプライアンスチェックを実行
    const result = this.check(text, options);

    // E-E-A-T バリデーションを実行
    const eeatValidator = new EEATValidator();
    const eeatScore = eeatValidator.validate(article);

    return {
      ...result,
      eeatScore: {
        total: eeatScore.total,
        experience: eeatScore.experience,
        expertise: eeatScore.expertise,
        authoritativeness: eeatScore.authoritativeness,
        trustworthiness: eeatScore.trustworthiness,
        details: eeatScore.details,
      },
    };
  }
}

// デフォルトインスタンスのエクスポート
export const defaultChecker = new ComplianceChecker();
