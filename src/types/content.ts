/**
 * コンテンツ型定義
 * 記事生成パイプライン用の型定義
 * 薬機法第66条・67条 / 景表法 / ステマ規制 / YMYL / E-E-A-T 対応
 */

import type { ComplianceResult } from "@/lib/compliance/types";

// ============================================================
// カテゴリ
// ============================================================

/** コンテンツカテゴリ */
export type ContentCategory = "aga" | "hair-removal" | "skincare" | "ed" | "column";

// ============================================================
// 記事構成要素
// ============================================================

/** 見出しレベル */
export type HeadingLevel = "h2" | "h3" | "h4";

/** 記事セクション */
export interface ArticleSection {
  /** 見出しテキスト */
  heading: string;
  /** 見出しレベル */
  level: HeadingLevel;
  /** 本文テキスト（マークダウン形式） */
  content: string;
  /** このセクションに含まれるサブセクション */
  subsections?: ArticleSection[];
}

/** SEOメタデータ */
export interface SEOMetadata {
  /** ページタイトル（30〜35文字推奨） */
  title: string;
  /** メタディスクリプション（120文字以内） */
  description: string;
  /** キーワードリスト */
  keywords: string[];
  /** OGP画像URL */
  ogImage?: string;
  /** 正規URL */
  canonicalUrl?: string;
}

/** 著者情報（E-E-A-T対応） */
export interface AuthorInfo {
  /** 著者名 */
  name: string;
  /** 資格・専門性（例: 皮膚科医、薬剤師等） */
  credentials: string;
  /** 著者プロフィール */
  bio: string;
  /** 著者画像URL */
  imageUrl?: string;
}

/** 参考文献（E-E-A-T対応） */
export interface Reference {
  /** 文献タイトル */
  title: string;
  /** URL（PubMed等） */
  url: string;
  /** 著者 */
  author?: string;
  /** 発行年 */
  year?: number;
  /** 出典名（雑誌名・サイト名等） */
  source?: string;
}

// ============================================================
// 記事
// ============================================================

/** 記事 */
export interface Article {
  /** 記事ID */
  id?: string;
  /** タイトル */
  title: string;
  /** URLスラッグ */
  slug: string;
  /** リード文（記事の冒頭要約） */
  lead: string;
  /** 本文コンテンツ（マークダウン形式） */
  content: string;
  /** 記事セクション */
  sections: ArticleSection[];
  /** コンテンツカテゴリ */
  category: ContentCategory;
  /** SEOメタデータ */
  seo: SEOMetadata;
  /** 著者情報 */
  author: AuthorInfo;
  /** 監修者情報（YMYL対応で必須） */
  supervisor?: AuthorInfo;
  /** 参考文献リスト（E-E-A-T対応） */
  references: Reference[];
  /** 公開日（ISO 8601形式） */
  publishedAt: string;
  /** 最終更新日（ISO 8601形式） */
  updatedAt: string;
  /** 読了時間（分） */
  readingTime?: number;
  /** タグリスト */
  tags?: string[];
  /** PR表記フラグ（ステマ規制対応） */
  hasPRDisclosure: boolean;
  /** コンプライアンス適合フラグ */
  isCompliant: boolean;
  /** コンプライアンススコア（0〜100） */
  complianceScore?: number;
}

// ============================================================
// 記事生成リクエスト・レスポンス
// ============================================================

/** 記事生成トーン */
export type ContentTone =
  | "informative"  // 情報提供型（客観的・信頼性重視）
  | "friendly"     // 親しみやすい
  | "professional" // 専門家向け
  | "comparison";  // 比較・ランキング型

/** 記事生成リクエスト */
export interface ContentGenerationRequest {
  /** コンテンツカテゴリ */
  category: ContentCategory;
  /** メインキーワード */
  keyword: string;
  /** サブキーワードリスト */
  subKeywords?: string[];
  /** ターゲット読者（例: 20代男性、AGA初期段階） */
  targetAudience: string;
  /** 記事トーン */
  tone: ContentTone;
  /** 目標文字数（デフォルト: 3000） */
  targetLength?: number;
  /** 含めるべきASPリンク */
  affiliateLinks?: AffiliateLink[];
  /** 記事の構成指示（オプション） */
  outlineHints?: string[];
}

/** ASPアフィリエイトリンク情報 */
export interface AffiliateLink {
  /** プログラム名 */
  programName: string;
  /** ASP名 */
  aspName: string;
  /** アフィリエイトURL */
  url: string;
  /** 報酬金額 */
  rewardAmount: number;
  /** アンカーテキスト */
  anchorText: string;
}

/** 記事生成レスポンス */
export interface ContentGenerationResponse {
  /** 生成された記事 */
  article: Article;
  /** SEOメタデータ */
  seo: SEOMetadata;
  /** コンプライアンスチェック結果 */
  compliance: ComplianceResult;
  /** 生成に使用したモデル */
  model: string;
  /** 生成日時（ISO 8601形式） */
  generatedAt: string;
  /** 生成にかかった時間（ms） */
  processingTimeMs?: number;
}

// ============================================================
// 目次
// ============================================================

/** 目次アイテム */
export interface TocItem {
  /** 見出しテキスト */
  text: string;
  /** アンカーID（スラッグ化された見出し） */
  id: string;
  /** 見出しレベル */
  level: HeadingLevel;
  /** 子アイテム */
  children?: TocItem[];
}
