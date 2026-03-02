/**
 * コンプライアンスチェッカー 型定義
 * 薬機法第66条・67条、景表法、ステマ規制対応
 */

export type Category = "aga" | "hair_removal" | "skincare" | "ed" | "common";

export type ViolationType =
  | "pharmaceutical_law"  // 薬機法第66条・67条
  | "representation_law"  // 景表法（優良誤認・有利誤認）
  | "stealth_marketing"   // ステマ規制
  | "superlative"         // 最大級表現
  | "missing_pr_disclosure"; // PR表記欠如

export type Severity = "high" | "medium" | "low";

export interface NGEntry {
  id: string;
  ng: string;
  ok: string;
  reason: string;
  severity: Severity;
}

export interface DictionaryFile {
  category: string;
  description: string;
  entries: NGEntry[];
}

export interface Violation {
  id: string;
  type: ViolationType;
  severity: Severity;
  ngText: string;
  suggestedText: string;
  reason: string;
  position: {
    start: number;
    end: number;
  };
}

export interface ComplianceResult {
  isCompliant: boolean;
  violations: Violation[];
  fixedText: string;
  hasPRDisclosure: boolean;
  missingItems: string[];
  score: number; // 0-100 (100 = 完全準拠)
}

export interface CheckerOptions {
  categories?: Category[];
  autoFix?: boolean;
  strictMode?: boolean; // trueの場合、低リスクもエラーとして扱う
}

export interface PRDisclosureTemplate {
  type: "affiliate" | "advertisement" | "pr" | "sponsored";
  text: string;
  position: "top" | "bottom" | "both";
}
