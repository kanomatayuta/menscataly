/**
 * カテゴリ別CTAテンプレート
 * 薬機法・景表法・ステマ規制に準拠した日本語CTAテキスト
 */

import type { ContentCategory } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** CTA配置位置 */
export type CtaPlacement = 'inline' | 'block' | 'sidebar'

/** CTAバリアント */
export type CtaVariant = 'primary' | 'secondary'

/** CTAテンプレート */
export interface CtaTemplate {
  /** CTAテキスト */
  text: string
  /** 配置位置 */
  position: CtaPlacement
  /** バリアント */
  variant: CtaVariant
}

// ============================================================
// カテゴリ別CTAテンプレート
// ============================================================

export const CTA_TEMPLATES: Record<ContentCategory, CtaTemplate[]> = {
  // =========================================================
  // AGA
  // =========================================================
  aga: [
    {
      text: 'まずは無料カウンセリングで、ご自身の薄毛の状態を専門医に相談してみませんか？オンラインで手軽に予約できます。',
      position: 'block',
      variant: 'primary',
    },
    {
      text: 'AGA治療の詳細や費用については、各クリニックの公式サイトでご確認ください。',
      position: 'inline',
      variant: 'secondary',
    },
    {
      text: 'オンライン診療なら、自宅から専門医の診察を受けられます。まずは気軽に相談してみましょう。',
      position: 'block',
      variant: 'primary',
    },
    {
      text: '治療プランや費用の詳細は、無料カウンセリングでご確認いただけます。',
      position: 'sidebar',
      variant: 'secondary',
    },
  ],

  // =========================================================
  // ED
  // =========================================================
  ed: [
    {
      text: 'プライバシーに配慮したオンライン診療で、専門医に相談してみませんか？ご自宅から受診可能です。',
      position: 'block',
      variant: 'primary',
    },
    {
      text: '治療薬の種類や費用の詳細は、各クリニックの公式サイトをご確認ください。',
      position: 'inline',
      variant: 'secondary',
    },
    {
      text: 'EDは適切な治療により改善が期待できます。まずは専門医への相談から始めてみましょう。',
      position: 'block',
      variant: 'primary',
    },
    {
      text: 'オンライン診療対応のクリニックなら、人目を気にせず受診できます。詳細は公式サイトをご覧ください。',
      position: 'sidebar',
      variant: 'secondary',
    },
  ],

  // =========================================================
  // 脱毛
  // =========================================================
  'hair-removal': [
    {
      text: 'まずは無料カウンセリングで、ご自身に合った脱毛プランを相談してみませんか？',
      position: 'block',
      variant: 'primary',
    },
    {
      text: '各クリニック・サロンの詳細な料金プランは、公式サイトでご確認ください。',
      position: 'inline',
      variant: 'secondary',
    },
    {
      text: '初回トライアルプランを利用すれば、痛みや効果を実際に体験できます。詳細は公式サイトをご覧ください。',
      position: 'block',
      variant: 'primary',
    },
    {
      text: 'カウンセリングは無料のクリニックが多いため、まずは気軽に相談してみることをおすすめします。',
      position: 'sidebar',
      variant: 'secondary',
    },
  ],

  // =========================================================
  // スキンケア
  // =========================================================
  skincare: [
    {
      text: 'ご自身の肌質に合ったスキンケアアイテムを見つけてみませんか？詳細は各商品の公式サイトをご覧ください。',
      position: 'block',
      variant: 'primary',
    },
    {
      text: '肌の悩みが改善しない場合は、皮膚科専門医への相談もご検討ください。',
      position: 'inline',
      variant: 'secondary',
    },
    {
      text: 'まずは肌質診断から始めてみましょう。多くのブランドが無料の肌診断サービスを提供しています。',
      position: 'block',
      variant: 'primary',
    },
    {
      text: 'スキンケアの効果は継続が大切です。気になるアイテムは公式サイトで詳細をチェックしてみてください。',
      position: 'sidebar',
      variant: 'secondary',
    },
  ],

  // =========================================================
  // コラム
  // =========================================================
  column: [
    {
      text: '関連する記事もあわせてご覧ください。',
      position: 'block',
      variant: 'secondary',
    },
  ],
}
