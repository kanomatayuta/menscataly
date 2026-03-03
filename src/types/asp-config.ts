/**
 * ASP (アフィリエイトサービスプロバイダ) 型定義
 * afb, A8.net, AccessTrade, ValueCommerce, Felmat 対応
 */

import type { ContentCategory } from "@/types/content";

export type AspName = "afb" | "a8" | "accesstrade" | "valuecommerce" | "felmat";

export interface AspProgram {
  id: string;
  asp: AspName;
  programName: string;
  category: ContentCategory;
  rewardAmountJpy: number;
  rewardType: "fixed" | "percentage";
  conversionCondition: string;
  affiliateUrl: string;
  lpUrl: string;
  itpCompatible: boolean;
  isActive: boolean;
  priority: number;
  approvalRate?: number;
  epc?: number;
}

export interface AspCategoryMapping {
  category: ContentCategory;
  programs: AspProgram[];
  ctaTemplate: string;
  mentionTemplate: string;
}

export interface AspSelectionResult {
  selectedPrograms: AspProgram[];
  ctaHtml: string;
  mentionTexts: string[];
  itpScripts: string[];
}

export interface ItpScriptConfig {
  asp: AspName;
  scriptUrl: string;
  attributes?: Record<string, string>;
  lazyLoad: boolean;
  description: string;
}
