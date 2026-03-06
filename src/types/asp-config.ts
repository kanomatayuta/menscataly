/**
 * ASP (アフィリエイトサービスプロバイダ) 型定義
 * afb, A8.net, AccessTrade, ValueCommerce, Felmat, Moshimo 対応
 */

import type { ContentCategory } from "@/types/content";

export type AspName = "afb" | "a8" | "accesstrade" | "valuecommerce" | "felmat" | "moshimo";

export type AdCreativeType = 'text' | 'banner'

export interface AdCreative {
  id: string
  type: AdCreativeType
  label: string
  affiliateUrl?: string
  anchorText?: string
  rawHtml?: string
  /** バナー画像URL (rawHtml が無い場合に使用) */
  imageUrl?: string
  /** バナー幅 (px) */
  width?: number
  /** バナー高さ (px) */
  height?: number
  isActive: boolean
  useForInjection: boolean
  useForBanner: boolean
}

export interface RewardTier {
  condition: string;
  amount: number;
  type: 'fixed' | 'percentage';
  productPrice?: number;
}

export interface AspProgram {
  id: string;
  aspName: AspName;
  programName: string;
  programId: string;
  category: ContentCategory;
  rewardTiers: RewardTier[];
  approvalRate: number;
  epc: number;
  itpSupport: boolean;
  cookieDuration: number;
  isActive: boolean;
  priority?: number;
  recommendedAnchors: string[];
  notes?: string;
  adCreatives?: AdCreative[];
  advertiserName?: string;
  aspCategory?: string;
  confirmationPeriodDays?: number;
  partnershipStatus?: string;
  lastApprovalDate?: string | null;
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
