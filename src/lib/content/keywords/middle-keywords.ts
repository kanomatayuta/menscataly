/**
 * Phase 3 ミドルKWキーワードリスト（20件）
 *
 * Phase 2 のロングテール（低難易度・低ボリューム）から一段階上の
 * ミドル難易度・ミドルボリュームキーワードを対象とする。
 *
 * Categories:
 *   1. AGA治療 (5): 高ボリューム・競合キーワード
 *   2. ED治療 (3): 比較・ガイドキーワード
 *   3. 医療脱毛 (5): クリニック比較キーワード
 *   4. スキンケア (4): 製品レビューキーワード
 *   5. サプリメント (3): エビデンスベースキーワード
 *
 * 各キーワード: keyword, searchIntent, estimatedVolume, difficultyScore,
 *               articleType, suggestedTitle, relatedLongtails
 */

import type { ContentCategory } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** 検索意図 */
export type MiddleSearchIntent =
  | 'informational'   // 情報収集
  | 'commercial'      // 商業調査
  | 'transactional'   // 購入・申込
  | 'navigational'    // 特定サイトへの遷移

/** 記事タイプ */
export type MiddleArticleType =
  | 'comparison'      // 比較・ランキング
  | 'guide'           // 総合ガイド
  | 'review'          // レビュー
  | 'how-to'          // ハウツー
  | 'list'            // まとめ・リスト
  | 'cost-analysis'   // 費用分析

/** ミドルKWエントリ */
export interface MiddleKeyword {
  /** キーワードID */
  id: string
  /** メインキーワード */
  keyword: string
  /** カテゴリ */
  category: ContentCategory | 'supplement'
  /** 検索意図 */
  searchIntent: MiddleSearchIntent
  /** 推定月間検索ボリューム */
  estimatedVolume: number
  /** 競合難易度スコア（0-100、高いほど難しい） */
  difficultyScore: number
  /** 記事タイプ */
  articleType: MiddleArticleType
  /** 推奨タイトル */
  suggestedTitle: string
  /** 関連ロングテールキーワード */
  relatedLongtails: string[]
  /** ターゲットASP */
  targetASP: string[]
  /** ターゲットオーディエンス */
  targetAudience: string
  /** 推奨文字数 */
  targetLength: number
}

// ============================================================
// AGA治療 キーワード x 5（高ボリューム・競合）
// ============================================================

const AGA_MIDDLE_KEYWORDS: MiddleKeyword[] = [
  {
    id: 'p3-aga-001',
    keyword: 'AGA治療 おすすめクリニック',
    category: 'aga',
    searchIntent: 'commercial',
    estimatedVolume: 12100,
    difficultyScore: 62,
    articleType: 'comparison',
    suggestedTitle: 'AGA治療おすすめクリニック10選【2026年最新】費用・実績・口コミを徹底比較',
    relatedLongtails: [
      'AGA クリニック 評判',
      'AGA治療 クリニック ランキング',
      'AGA おすすめ 東京',
      'AGA治療 人気 クリニック',
    ],
    targetASP: ['AGAスキンクリニック', 'クリニックフォア', 'DMMオンラインクリニック', 'AGAヘアクリニック'],
    targetAudience: 'AGA治療を本格的に始めたい20〜50代男性',
    targetLength: 6000,
  },
  {
    id: 'p3-aga-002',
    keyword: 'AGA治療 費用 月額',
    category: 'aga',
    searchIntent: 'commercial',
    estimatedVolume: 8800,
    difficultyScore: 55,
    articleType: 'cost-analysis',
    suggestedTitle: 'AGA治療の月額費用はいくら？治療法別の相場とコスパ最強クリニック比較',
    relatedLongtails: [
      'AGA 月額 3000円',
      'AGA治療 安い クリニック',
      'フィナステリド 月額',
      'AGA 費用 相場 2026',
    ],
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'AGAヘアクリニック'],
    targetAudience: '費用面が気になりAGA治療を検討中の30〜40代男性',
    targetLength: 5500,
  },
  {
    id: 'p3-aga-003',
    keyword: 'AGAオンライン診療 比較',
    category: 'aga',
    searchIntent: 'commercial',
    estimatedVolume: 7200,
    difficultyScore: 58,
    articleType: 'comparison',
    suggestedTitle: 'AGAオンライン診療おすすめ8選を比較｜自宅で始める薄毛治療の最適解',
    relatedLongtails: [
      'AGA オンライン おすすめ',
      'AGA オンライン診療 安い',
      'AGA オンライン 処方',
      '薄毛 オンライン 診察',
    ],
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'AGAヘアクリニック', 'eLife'],
    targetAudience: '通院の手間をかけずAGA治療を始めたい20〜40代男性',
    targetLength: 5500,
  },
  {
    id: 'p3-aga-004',
    keyword: 'AGA治療 副作用',
    category: 'aga',
    searchIntent: 'informational',
    estimatedVolume: 9900,
    difficultyScore: 50,
    articleType: 'guide',
    suggestedTitle: 'AGA治療薬の副作用まとめ｜フィナステリド・デュタステリド・ミノキシジルのリスクと対策',
    relatedLongtails: [
      'フィナステリド 副作用 確率',
      'ミノキシジル 副作用 むくみ',
      'AGA 薬 肝臓',
      'AGA 治療 やめた 副作用',
    ],
    targetASP: ['AGAスキンクリニック', 'クリニックフォア', 'DMMオンラインクリニック'],
    targetAudience: 'AGA治療薬の安全性が気になる30〜50代男性',
    targetLength: 5000,
  },
  {
    id: 'p3-aga-005',
    keyword: 'AGA 初期脱毛 期間',
    category: 'aga',
    searchIntent: 'informational',
    estimatedVolume: 6600,
    difficultyScore: 45,
    articleType: 'how-to',
    suggestedTitle: 'AGA治療の初期脱毛はいつまで？期間・原因・乗り越え方を医師監修で解説',
    relatedLongtails: [
      'AGA 初期脱毛 いつから',
      'フィナステリド 初期脱毛 何ヶ月',
      'ミノキシジル 初期脱毛 ひどい',
      'AGA 初期脱毛 対処法',
    ],
    targetASP: ['クリニックフォア', 'AGAヘアクリニック', 'DMMオンラインクリニック'],
    targetAudience: 'AGA治療を開始して初期脱毛に不安を感じている30〜40代男性',
    targetLength: 4500,
  },
]

// ============================================================
// ED治療 キーワード x 3（比較・ガイド）
// ============================================================

const ED_MIDDLE_KEYWORDS: MiddleKeyword[] = [
  {
    id: 'p3-ed-001',
    keyword: 'ED治療 おすすめクリニック',
    category: 'ed',
    searchIntent: 'commercial',
    estimatedVolume: 8100,
    difficultyScore: 58,
    articleType: 'comparison',
    suggestedTitle: 'ED治療おすすめクリニック8選【2026年】オンライン対応・費用・評判を徹底比較',
    relatedLongtails: [
      'ED クリニック 評判',
      'ED治療 オンライン おすすめ',
      'ED 病院 選び方',
      'ED治療 人気 クリニック',
    ],
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'eLife'],
    targetAudience: 'ED治療を始めたいが病院選びに迷っている30〜60代男性',
    targetLength: 5500,
  },
  {
    id: 'p3-ed-002',
    keyword: 'ED治療薬 比較',
    category: 'ed',
    searchIntent: 'commercial',
    estimatedVolume: 6600,
    difficultyScore: 52,
    articleType: 'comparison',
    suggestedTitle: 'ED治療薬3種を徹底比較｜バイアグラ・シアリス・レビトラの効果・持続時間・価格',
    relatedLongtails: [
      'バイアグラ シアリス レビトラ 違い',
      'ED薬 効果 時間',
      'ED治療薬 ジェネリック 比較',
      'ED薬 一番効く',
    ],
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'eLife'],
    targetAudience: 'ED治療薬の最適な選択肢を知りたい30〜60代男性',
    targetLength: 5000,
  },
  {
    id: 'p3-ed-003',
    keyword: 'ED オンライン診療',
    category: 'ed',
    searchIntent: 'transactional',
    estimatedVolume: 7700,
    difficultyScore: 55,
    articleType: 'guide',
    suggestedTitle: 'EDのオンライン診療ガイド｜自宅で処方を受ける方法・費用・おすすめクリニック',
    relatedLongtails: [
      'ED オンライン 即日',
      'ED薬 処方 オンライン',
      'ED オンライン診療 安い',
      'ED 遠隔診療 おすすめ',
    ],
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'eLife'],
    targetAudience: 'プライバシーを重視してオンラインでED治療を受けたい30〜50代男性',
    targetLength: 5000,
  },
]

// ============================================================
// 医療脱毛 キーワード x 5（クリニック比較）
// ============================================================

const HAIR_REMOVAL_MIDDLE_KEYWORDS: MiddleKeyword[] = [
  {
    id: 'p3-hr-001',
    keyword: 'メンズ医療脱毛 おすすめ',
    category: 'hair-removal',
    searchIntent: 'commercial',
    estimatedVolume: 14800,
    difficultyScore: 65,
    articleType: 'comparison',
    suggestedTitle: 'メンズ医療脱毛おすすめクリニック12選【2026年版】料金・口コミ・効果を比較',
    relatedLongtails: [
      'メンズ脱毛 クリニック ランキング',
      'メンズ医療脱毛 安い',
      '男性 医療脱毛 人気',
      'メンズ脱毛 おすすめ 全身',
    ],
    targetASP: ['メンズリゼ', 'ゴリラクリニック', 'レジーナクリニックオム', 'メンズエミナル'],
    targetAudience: '医療脱毛クリニックを探している20〜30代男性',
    targetLength: 6500,
  },
  {
    id: 'p3-hr-002',
    keyword: 'ヒゲ脱毛 料金 比較',
    category: 'hair-removal',
    searchIntent: 'commercial',
    estimatedVolume: 9900,
    difficultyScore: 60,
    articleType: 'cost-analysis',
    suggestedTitle: 'ヒゲ脱毛の料金を10クリニック比較｜相場・最安プラン・コスパで選ぶならここ',
    relatedLongtails: [
      'ヒゲ脱毛 安い クリニック',
      'ヒゲ脱毛 総額 いくら',
      'ヒゲ脱毛 料金プラン 比較',
      'ヒゲ脱毛 コスパ',
    ],
    targetASP: ['メンズリゼ', 'ゴリラクリニック', 'メンズエミナル'],
    targetAudience: 'ヒゲ脱毛の費用対効果を重視する20〜30代男性',
    targetLength: 5500,
  },
  {
    id: 'p3-hr-003',
    keyword: 'ゴリラクリニック メンズリゼ 比較',
    category: 'hair-removal',
    searchIntent: 'commercial',
    estimatedVolume: 5400,
    difficultyScore: 48,
    articleType: 'comparison',
    suggestedTitle: 'ゴリラクリニックとメンズリゼを徹底比較｜料金・効果・口コミ・おすすめはどっち？',
    relatedLongtails: [
      'ゴリラクリニック メンズリゼ どっち',
      'メンズ脱毛 2択 比較',
      'ゴリラ メンズリゼ 違い',
      'メンズ脱毛 比較 2026',
    ],
    targetASP: ['ゴリラクリニック', 'メンズリゼ'],
    targetAudience: '大手2クリニックで迷っている20〜30代男性',
    targetLength: 5000,
  },
  {
    id: 'p3-hr-004',
    keyword: 'メンズ全身脱毛 おすすめ',
    category: 'hair-removal',
    searchIntent: 'commercial',
    estimatedVolume: 8100,
    difficultyScore: 58,
    articleType: 'comparison',
    suggestedTitle: 'メンズ全身脱毛おすすめクリニック8選｜料金・回数・痛み・口コミを比較',
    relatedLongtails: [
      '全身脱毛 メンズ 安い',
      'メンズ 全身脱毛 相場',
      '男性 全身脱毛 クリニック',
      'メンズ全身脱毛 回数',
    ],
    targetASP: ['メンズリゼ', 'ゴリラクリニック', 'レジーナクリニックオム', 'メンズエミナル'],
    targetAudience: '全身脱毛を検討している20〜30代男性',
    targetLength: 5500,
  },
  {
    id: 'p3-hr-005',
    keyword: 'VIO脱毛 メンズ おすすめ',
    category: 'hair-removal',
    searchIntent: 'commercial',
    estimatedVolume: 6600,
    difficultyScore: 52,
    articleType: 'comparison',
    suggestedTitle: 'メンズVIO脱毛おすすめクリニック7選｜料金・痛み・恥ずかしさへの配慮を比較',
    relatedLongtails: [
      'VIO脱毛 男 クリニック',
      'メンズVIO 脱毛 安い',
      'VIO脱毛 男性 恥ずかしい',
      'メンズ VIO 脱毛 体験',
    ],
    targetASP: ['メンズリゼ', 'ゴリラクリニック', 'レジーナクリニックオム'],
    targetAudience: 'VIO脱毛に興味があるが不安もある20〜40代男性',
    targetLength: 5000,
  },
]

// ============================================================
// スキンケア キーワード x 4（製品レビュー）
// ============================================================

const SKINCARE_MIDDLE_KEYWORDS: MiddleKeyword[] = [
  {
    id: 'p3-sc-001',
    keyword: 'メンズ化粧水 おすすめ',
    category: 'skincare',
    searchIntent: 'commercial',
    estimatedVolume: 12100,
    difficultyScore: 60,
    articleType: 'comparison',
    suggestedTitle: 'メンズ化粧水おすすめ15選【2026年】肌質別の選び方と正しい使い方',
    relatedLongtails: [
      'メンズ化粧水 ランキング',
      '化粧水 男性 人気',
      'メンズ 化粧水 ドラッグストア',
      '化粧水 メンズ コスパ',
    ],
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'バリューコマース'],
    targetAudience: 'スキンケアを始めたい・見直したい20〜30代男性',
    targetLength: 5500,
  },
  {
    id: 'p3-sc-002',
    keyword: 'メンズ洗顔料 おすすめ',
    category: 'skincare',
    searchIntent: 'commercial',
    estimatedVolume: 9900,
    difficultyScore: 55,
    articleType: 'comparison',
    suggestedTitle: 'メンズ洗顔料おすすめ12選｜ニキビ・テカリ・乾燥の悩み別に徹底比較',
    relatedLongtails: [
      'メンズ洗顔 ランキング',
      '男性 洗顔フォーム おすすめ',
      '洗顔料 メンズ ニキビ',
      'メンズ 洗顔 コスパ',
    ],
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'afb'],
    targetAudience: '自分に合った洗顔料を探している20〜30代男性',
    targetLength: 5000,
  },
  {
    id: 'p3-sc-003',
    keyword: 'メンズスキンケア 順番',
    category: 'skincare',
    searchIntent: 'informational',
    estimatedVolume: 8100,
    difficultyScore: 45,
    articleType: 'how-to',
    suggestedTitle: 'メンズスキンケアの正しい順番｜洗顔・化粧水・乳液の使い方を肌タイプ別に解説',
    relatedLongtails: [
      'メンズ スキンケア やり方',
      '男性 スキンケア 手順',
      'メンズ 化粧水 乳液 順番',
      'スキンケア 初心者 メンズ',
    ],
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net'],
    targetAudience: 'スキンケア初心者の20代男性',
    targetLength: 4500,
  },
  {
    id: 'p3-sc-004',
    keyword: 'メンズ 美容クリニック スキンケア',
    category: 'skincare',
    searchIntent: 'commercial',
    estimatedVolume: 5400,
    difficultyScore: 50,
    articleType: 'guide',
    suggestedTitle: 'メンズ美容クリニックのスキンケア施術ガイド｜ピーリング・レーザー・ダーマペンを比較',
    relatedLongtails: [
      '男性 美容皮膚科 おすすめ',
      'メンズ ピーリング 美容皮膚科',
      '男性 レーザー治療 シミ',
      'メンズ ダーマペン 効果',
    ],
    targetASP: ['A8.net', 'afb', 'アクセストレード'],
    targetAudience: 'セルフケアを超えた本格的な肌ケアに興味がある30〜40代男性',
    targetLength: 5000,
  },
]

// ============================================================
// サプリメント キーワード x 3（エビデンスベース）
// ============================================================

const SUPPLEMENT_MIDDLE_KEYWORDS: MiddleKeyword[] = [
  {
    id: 'p3-sp-001',
    keyword: '男性 サプリメント おすすめ',
    category: 'supplement',
    searchIntent: 'commercial',
    estimatedVolume: 8800,
    difficultyScore: 55,
    articleType: 'comparison',
    suggestedTitle: '男性向けサプリメントおすすめ10選｜目的別（活力・筋肉・肌・髪）の選び方ガイド',
    relatedLongtails: [
      '男性 サプリ ランキング',
      'メンズ サプリ 人気',
      '男性 サプリ 30代',
      '活力 サプリ 男性',
    ],
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'バリューコマース'],
    targetAudience: 'サプリメントで体調改善を目指す30〜50代男性',
    targetLength: 5500,
  },
  {
    id: 'p3-sp-002',
    keyword: '育毛サプリ 効果 エビデンス',
    category: 'supplement',
    searchIntent: 'informational',
    estimatedVolume: 5400,
    difficultyScore: 42,
    articleType: 'review',
    suggestedTitle: '育毛サプリに効果はある？科学的エビデンスに基づく成分別の評価とAGA治療との違い',
    relatedLongtails: [
      '育毛 サプリ 本当に効く',
      '薄毛 サプリ 科学的根拠',
      '育毛 サプリ AGA 違い',
      'ビオチン 亜鉛 髪 効果',
    ],
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'DMMオンラインクリニック'],
    targetAudience: 'サプリで薄毛対策をしたいがエビデンスを重視する30〜50代男性',
    targetLength: 5000,
  },
  {
    id: 'p3-sp-003',
    keyword: 'プロテイン おすすめ メンズ 美容',
    category: 'supplement',
    searchIntent: 'commercial',
    estimatedVolume: 4400,
    difficultyScore: 40,
    articleType: 'comparison',
    suggestedTitle: '美容効果も期待できるメンズプロテインおすすめ8選｜肌・髪・筋肉に効く選び方',
    relatedLongtails: [
      'プロテイン 美肌 メンズ',
      'コラーゲン プロテイン 男',
      'プロテイン 肌 ツヤ',
      '美容プロテイン 男性',
    ],
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'バリューコマース'],
    targetAudience: 'トレーニングと美容を両立したい20〜30代男性',
    targetLength: 4500,
  },
]

// ============================================================
// エクスポート
// ============================================================

/** Phase 3 全20ミドルKWキーワード */
export const MIDDLE_KEYWORDS: MiddleKeyword[] = [
  ...AGA_MIDDLE_KEYWORDS,
  ...ED_MIDDLE_KEYWORDS,
  ...HAIR_REMOVAL_MIDDLE_KEYWORDS,
  ...SKINCARE_MIDDLE_KEYWORDS,
  ...SUPPLEMENT_MIDDLE_KEYWORDS,
]

/** カテゴリ別ミドルKWを取得 */
export function getMiddleKeywordsByCategory(
  category: MiddleKeyword['category']
): MiddleKeyword[] {
  return MIDDLE_KEYWORDS.filter((kw) => kw.category === category)
}

/** 検索意図別ミドルKWを取得 */
export function getMiddleKeywordsByIntent(intent: MiddleSearchIntent): MiddleKeyword[] {
  return MIDDLE_KEYWORDS.filter((kw) => kw.searchIntent === intent)
}

/** 難易度スコアの低い順（攻略しやすい順）でソート */
export function getMiddleKeywordsByDifficulty(): MiddleKeyword[] {
  return [...MIDDLE_KEYWORDS].sort((a, b) => a.difficultyScore - b.difficultyScore)
}

/** 推定ボリュームの高い順でソート */
export function getMiddleKeywordsByVolume(): MiddleKeyword[] {
  return [...MIDDLE_KEYWORDS].sort((a, b) => b.estimatedVolume - a.estimatedVolume)
}

/** IDでミドルKWを取得 */
export function getMiddleKeywordById(id: string): MiddleKeyword | undefined {
  return MIDDLE_KEYWORDS.find((kw) => kw.id === id)
}

/** 記事タイプ別ミドルKWを取得 */
export function getMiddleKeywordsByArticleType(type: MiddleArticleType): MiddleKeyword[] {
  return MIDDLE_KEYWORDS.filter((kw) => kw.articleType === type)
}

/** 全カテゴリのミドルKW統計を取得 */
export function getMiddleKeywordStats(): {
  totalKeywords: number
  byCategory: Record<string, number>
  avgDifficulty: number
  avgVolume: number
  totalEstimatedVolume: number
} {
  const byCategory: Record<string, number> = {}
  let totalDifficulty = 0
  let totalVolume = 0

  for (const kw of MIDDLE_KEYWORDS) {
    byCategory[kw.category] = (byCategory[kw.category] ?? 0) + 1
    totalDifficulty += kw.difficultyScore
    totalVolume += kw.estimatedVolume
  }

  return {
    totalKeywords: MIDDLE_KEYWORDS.length,
    byCategory,
    avgDifficulty: Math.round(totalDifficulty / MIDDLE_KEYWORDS.length),
    avgVolume: Math.round(totalVolume / MIDDLE_KEYWORDS.length),
    totalEstimatedVolume: totalVolume,
  }
}
