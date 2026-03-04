/**
 * ASP (アフィリエイトサービスプロバイダ) 型定義
 * afb, A8.net, AccessTrade, ValueCommerce, Felmat, Moshimo 対応
 */

import type { ContentCategory } from "@/types/content";

export type AspName = "afb" | "a8" | "accesstrade" | "valuecommerce" | "felmat" | "moshimo";

export interface AspProgram {
  id: string;
  aspName: AspName;
  programName: string;
  programId: string;
  category: ContentCategory;
  affiliateUrl: string;
  rewardAmount: number;
  rewardType: "fixed" | "percentage";
  conversionCondition?: string;
  approvalRate: number;
  epc: number;
  itpSupport: boolean;
  cookieDuration: number;
  isActive: boolean;
  priority?: number;
  recommendedAnchors: string[];
  landingPageUrl: string;
  notes?: string;
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

export interface ItpMitigationConfig {
  aspName: AspName;
  scriptUrl: string;
  scriptAttributes: Record<string, string>;
  lazyLoad: boolean;
  sameSiteCookie: "None" | "Lax" | "Strict";
}
