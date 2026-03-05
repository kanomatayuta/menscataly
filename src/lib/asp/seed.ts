/**
 * ASPプログラム シードデータ
 * 5 ASP ネットワーク × 各カテゴリ = 24 プログラム
 *
 * 報酬レンジ:
 *   afb:           ¥8,000 ~ ¥20,000/CV (AGA/EDクリニック中心)
 *   A8.net:        ¥5,000 ~ ¥18,000 (全カテゴリ)
 *   AccessTrade:   ¥6,000 ~ ¥25,000 (脱毛/美容)
 *   ValueCommerce: ¥7,000 ~ ¥22,000 (EC/物販)
 *   Felmat/Moshimo: ¥0 ~ ¥30,000 (物販/クリニック)
 */

import type { AspName, AdCreative, RewardTier } from '@/types/asp-config'
import type { ContentCategory } from '@/types/content'

// ============================================================
// シードデータ型定義
// ============================================================

export interface AspProgramSeed {
  id: string
  aspName: AspName | 'moshimo'
  programName: string
  programId: string
  category: ContentCategory
  rewardTiers: RewardTier[]
  approvalRate: number
  epc: number
  itpSupport: boolean
  cookieDuration: number
  isActive: boolean
  priority: number
  recommendedAnchors: string[]
  notes?: string
  adCreatives?: AdCreative[]
  advertiserName?: string
  aspCategory?: string
  confirmationPeriodDays?: number
  partnershipStatus?: string
  lastApprovalDate?: string | null
}

// ============================================================
// シードデータ (24 プログラム)
// ============================================================

export const ASP_SEED_DATA: AspProgramSeed[] = [
  // ── afb (¥8,000 ~ ¥20,000) ────────────────────────────────
  {
    id: 'afb-aga-001',
    aspName: 'afb',
    programName: 'AGAスキンクリニック',
    programId: 'afb-prog-aga-001',
    category: 'aga',
    rewardTiers: [{ condition: '無料カウンセリング予約完了', amount: 15000, type: 'fixed' }],
    approvalRate: 72,
    epc: 85.5,
    itpSupport: true,
    cookieDuration: 60,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['AGAスキンクリニック 公式サイト', 'AGA治療の無料カウンセリング', 'AGA治療を始める'],
  },
  {
    id: 'afb-hair-001',
    aspName: 'afb',
    programName: 'メンズリゼクリニック',
    programId: 'afb-prog-hair-001',
    category: 'hair-removal',
    rewardTiers: [{ condition: '無料カウンセリング予約完了', amount: 20000, type: 'fixed' }],
    approvalRate: 68,
    epc: 92.3,
    itpSupport: true,
    cookieDuration: 60,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['メンズリゼ 公式サイト', 'メンズ脱毛の無料カウンセリング', '医療脱毛を始める'],
  },
  {
    id: 'afb-skin-001',
    aspName: 'afb',
    programName: 'ゴリラクリニック スキンケア',
    programId: 'afb-prog-skin-001',
    category: 'skincare',
    rewardTiers: [{ condition: '初回トライアル申込完了', amount: 8000, type: 'fixed' }],
    approvalRate: 75,
    epc: 45.2,
    itpSupport: true,
    cookieDuration: 45,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['ゴリラクリニック スキンケア', 'メンズ美肌治療', '肌悩みを相談する'],
  },
  {
    id: 'afb-ed-001',
    aspName: 'afb',
    programName: 'クリニックフォア ED',
    programId: 'afb-prog-ed-001',
    category: 'ed',
    rewardTiers: [{ condition: 'オンライン診療予約完了', amount: 10000, type: 'fixed' }],
    approvalRate: 80,
    epc: 62.8,
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['クリニックフォア ED治療', 'オンラインED診療', 'ED治療の相談をする'],
  },

  // ── A8.net (¥5,000 ~ ¥18,000) ─────────────────────────────
  {
    id: 'a8-aga-001',
    aspName: 'a8',
    programName: 'Dクリニック',
    programId: 'a8-prog-aga-001',
    category: 'aga',
    rewardTiers: [{ condition: '無料カウンセリング予約完了', amount: 12000, type: 'fixed' }],
    approvalRate: 65,
    epc: 70.2,
    itpSupport: false,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['Dクリニック 公式サイト', '薄毛治療の専門医に相談', 'AGA治療実績豊富なクリニック'],
  },
  {
    id: 'a8-hair-001',
    aspName: 'a8',
    programName: 'レジーナクリニック オム',
    programId: 'a8-prog-hair-001',
    category: 'hair-removal',
    rewardTiers: [{ condition: '無料カウンセリング予約完了', amount: 18000, type: 'fixed' }],
    approvalRate: 70,
    epc: 78.6,
    itpSupport: false,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['レジーナクリニック オム', 'メンズ医療脱毛', '男性脱毛の相談をする'],
  },
  {
    id: 'a8-skin-001',
    aspName: 'a8',
    programName: 'メンズスキンケア BULK HOMME',
    programId: 'a8-prog-skin-001',
    category: 'skincare',
    rewardTiers: [{ condition: '初回購入完了', amount: 5000, type: 'fixed' }],
    approvalRate: 82,
    epc: 38.4,
    itpSupport: false,
    cookieDuration: 45,
    isActive: true,
    priority: 3,
    recommendedAnchors: ['BULK HOMME 公式サイト', 'メンズスキンケアを始める', '男性用基礎化粧品'],
  },
  {
    id: 'a8-ed-001',
    aspName: 'a8',
    programName: 'DMMオンラインクリニック ED',
    programId: 'a8-prog-ed-001',
    category: 'ed',
    rewardTiers: [{ condition: 'オンライン診療予約完了', amount: 8000, type: 'fixed' }],
    approvalRate: 78,
    epc: 55.1,
    itpSupport: false,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['DMMオンラインクリニック', 'オンラインED診療', 'ED薬のオンライン処方'],
  },

  // ── AccessTrade (¥6,000 ~ ¥25,000) ────────────────────────
  {
    id: 'at-aga-001',
    aspName: 'accesstrade',
    programName: '銀座総合美容クリニック AGA',
    programId: 'at-prog-aga-001',
    category: 'aga',
    rewardTiers: [{ condition: '無料相談予約完了', amount: 18000, type: 'fixed' }],
    approvalRate: 60,
    epc: 95.0,
    itpSupport: true,
    cookieDuration: 45,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['銀座総合美容クリニック', 'AGA治療の専門院', '薄毛治療の無料相談'],
  },
  {
    id: 'at-hair-001',
    aspName: 'accesstrade',
    programName: 'メンズエミナルクリニック',
    programId: 'at-prog-hair-001',
    category: 'hair-removal',
    rewardTiers: [{ condition: '無料カウンセリング予約完了', amount: 25000, type: 'fixed' }],
    approvalRate: 62,
    epc: 110.5,
    itpSupport: true,
    cookieDuration: 45,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['メンズエミナル 公式サイト', '低価格メンズ脱毛', '医療脱毛の無料カウンセリング'],
  },
  {
    id: 'at-skin-001',
    aspName: 'accesstrade',
    programName: 'オルビス Mr.',
    programId: 'at-prog-skin-001',
    category: 'skincare',
    rewardTiers: [{ condition: '初回購入完了', amount: 6000, type: 'fixed' }],
    approvalRate: 85,
    epc: 42.0,
    itpSupport: true,
    cookieDuration: 60,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['オルビス Mr. 公式サイト', 'メンズ用スキンケア', '男性向け化粧水'],
  },
  {
    id: 'at-ed-001',
    aspName: 'accesstrade',
    programName: 'イースト駅前クリニック ED',
    programId: 'at-prog-ed-001',
    category: 'ed',
    rewardTiers: [{ condition: '初診予約完了', amount: 12000, type: 'fixed' }],
    approvalRate: 70,
    epc: 72.5,
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['イースト駅前クリニック', 'ED治療薬の処方', '駅前でED相談'],
  },

  // ── ValueCommerce (¥7,000 ~ ¥22,000) ──────────────────────
  {
    id: 'vc-aga-001',
    aspName: 'valuecommerce',
    programName: 'ウィルAGAクリニック',
    programId: 'vc-prog-aga-001',
    category: 'aga',
    rewardTiers: [{ condition: '無料診断予約完了', amount: 20000, type: 'fixed' }],
    approvalRate: 58,
    epc: 88.0,
    itpSupport: false,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['ウィルAGAクリニック', 'オーダーメイドAGA治療', 'AGA治療の無料診断'],
  },
  {
    id: 'vc-hair-001',
    aspName: 'valuecommerce',
    programName: 'メンズじぶんクリニック',
    programId: 'vc-prog-hair-001',
    category: 'hair-removal',
    rewardTiers: [{ condition: '無料カウンセリング予約完了', amount: 22000, type: 'fixed' }],
    approvalRate: 64,
    epc: 98.2,
    itpSupport: false,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['メンズじぶんクリニック', '全身脱毛プラン', 'メンズ脱毛を始める'],
  },
  {
    id: 'vc-skin-001',
    aspName: 'valuecommerce',
    programName: 'NULL スキンケアライン',
    programId: 'vc-prog-skin-001',
    category: 'skincare',
    rewardTiers: [{ condition: '初回購入完了', amount: 7000, type: 'fixed' }],
    approvalRate: 78,
    epc: 35.8,
    itpSupport: false,
    cookieDuration: 45,
    isActive: true,
    priority: 3,
    recommendedAnchors: ['NULL スキンケア', 'メンズBBクリーム', '男性用スキンケア'],
  },
  {
    id: 'vc-ed-001',
    aspName: 'valuecommerce',
    programName: 'フィットクリニック ED',
    programId: 'vc-prog-ed-001',
    category: 'ed',
    rewardTiers: [{ condition: '初診予約完了', amount: 9000, type: 'fixed' }],
    approvalRate: 74,
    epc: 50.3,
    itpSupport: false,
    cookieDuration: 30,
    isActive: true,
    priority: 3,
    recommendedAnchors: ['フィットクリニック ED治療', 'オンライン診療でED治療', 'ED薬を処方してもらう'],
  },

  // ── Felmat (¥10,000 ~ ¥30,000) ────────────────────────────
  {
    id: 'fm-aga-001',
    aspName: 'felmat',
    programName: 'B&Hメディカルクリニック AGA',
    programId: 'fm-prog-aga-001',
    category: 'aga',
    rewardTiers: [{ condition: '無料相談予約完了', amount: 25000, type: 'fixed' }],
    approvalRate: 55,
    epc: 102.0,
    itpSupport: true,
    cookieDuration: 60,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['B&Hメディカルクリニック', 'AGA専門治療', '発毛治療の無料相談'],
  },
  {
    id: 'fm-hair-001',
    aspName: 'felmat',
    programName: 'ダビデクリニック メンズ脱毛',
    programId: 'fm-prog-hair-001',
    category: 'hair-removal',
    rewardTiers: [{ condition: '無料体験予約完了', amount: 30000, type: 'fixed' }],
    approvalRate: 52,
    epc: 120.0,
    itpSupport: true,
    cookieDuration: 60,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['ダビデクリニック', '新宿メンズ脱毛', 'ヒゲ脱毛の無料体験'],
  },
  {
    id: 'fm-skin-001',
    aspName: 'felmat',
    programName: 'ZO SKIN HEALTH メンズ',
    programId: 'fm-prog-skin-001',
    category: 'skincare',
    rewardTiers: [{ condition: 'トライアルセット購入完了', amount: 10000, type: 'fixed' }],
    approvalRate: 70,
    epc: 52.0,
    itpSupport: true,
    cookieDuration: 45,
    isActive: true,
    priority: 2,
    recommendedAnchors: ['ZO SKIN HEALTH', 'ドクターズコスメ', 'メンズ美肌プログラム'],
  },
  {
    id: 'fm-ed-001',
    aspName: 'felmat',
    programName: 'メンズライフクリニック ED',
    programId: 'fm-prog-ed-001',
    category: 'ed',
    rewardTiers: [{ condition: '初診予約完了', amount: 15000, type: 'fixed' }],
    approvalRate: 66,
    epc: 78.0,
    itpSupport: true,
    cookieDuration: 45,
    isActive: true,
    priority: 1,
    recommendedAnchors: ['メンズライフクリニック', 'ED治療専門院', '男性機能の無料相談'],
  },

  // ── Moshimo (物販 ¥0 = 成果報酬型) ────────────────────────
  {
    id: 'moshimo-aga-001',
    aspName: 'moshimo',
    programName: 'Amazon AGA関連商品',
    programId: 'moshimo-prog-aga-001',
    category: 'aga',
    rewardTiers: [{ condition: '商品購入完了 (W報酬+12%)', amount: 0, type: 'percentage' }],
    approvalRate: 90,
    epc: 25.0,
    itpSupport: true,
    cookieDuration: 24,
    isActive: true,
    priority: 4,
    recommendedAnchors: ['育毛剤をAmazonで探す', 'AGA関連商品一覧', 'Amazonで購入する'],
    notes: 'もしもアフィリエイト W報酬プログラム',
  },
  {
    id: 'moshimo-hair-001',
    aspName: 'moshimo',
    programName: 'Amazon 脱毛関連商品',
    programId: 'moshimo-prog-hair-001',
    category: 'hair-removal',
    rewardTiers: [{ condition: '商品購入完了 (W報酬+12%)', amount: 0, type: 'percentage' }],
    approvalRate: 90,
    epc: 22.0,
    itpSupport: true,
    cookieDuration: 24,
    isActive: true,
    priority: 4,
    recommendedAnchors: ['脱毛グッズをAmazonで探す', '家庭用脱毛器一覧', 'Amazonで購入する'],
    notes: 'もしもアフィリエイト W報酬プログラム',
  },
  {
    id: 'moshimo-skin-001',
    aspName: 'moshimo',
    programName: '楽天 メンズスキンケア',
    programId: 'moshimo-prog-skin-001',
    category: 'skincare',
    rewardTiers: [{ condition: '商品購入完了 (W報酬+12%)', amount: 0, type: 'percentage' }],
    approvalRate: 88,
    epc: 18.5,
    itpSupport: true,
    cookieDuration: 24,
    isActive: true,
    priority: 4,
    recommendedAnchors: ['楽天でスキンケア商品を探す', 'メンズ化粧品ランキング', '楽天で購入する'],
    notes: 'もしもアフィリエイト W報酬プログラム',
  },
  {
    id: 'moshimo-ed-001',
    aspName: 'moshimo',
    programName: 'Amazon ED関連サプリ',
    programId: 'moshimo-prog-ed-001',
    category: 'ed',
    rewardTiers: [{ condition: '商品購入完了 (W報酬+12%)', amount: 0, type: 'percentage' }],
    approvalRate: 85,
    epc: 20.0,
    itpSupport: true,
    cookieDuration: 24,
    isActive: true,
    priority: 4,
    recommendedAnchors: ['Amazonでサプリを探す', '活力サプリメント一覧', 'Amazonで購入する'],
    notes: 'もしもアフィリエイト W報酬プログラム',
  },
]

// ============================================================
// シードデータ クエリヘルパー
// ============================================================

/**
 * 全シードデータを取得する
 */
export function getAllSeedPrograms(): AspProgramSeed[] {
  return ASP_SEED_DATA
}

/**
 * ASP名でシードデータを絞り込む
 */
export function getSeedProgramsByAsp(aspName: string): AspProgramSeed[] {
  return ASP_SEED_DATA.filter((p) => p.aspName === aspName)
}

/**
 * カテゴリでシードデータを絞り込む
 */
export function getSeedProgramsByCategory(category: ContentCategory): AspProgramSeed[] {
  return ASP_SEED_DATA.filter((p) => p.category === category)
}

/**
 * IDでシードデータを検索する
 */
export function getSeedProgramById(id: string): AspProgramSeed | undefined {
  return ASP_SEED_DATA.find((p) => p.id === id)
}

/**
 * ASP名一覧を取得する (ユニーク)
 */
export function getAspNames(): string[] {
  return [...new Set(ASP_SEED_DATA.map((p) => p.aspName))]
}

/**
 * ASP別の報酬レンジサマリーを取得する
 */
export function getRewardRangeSummary(): Array<{
  aspName: string
  minReward: number
  maxReward: number
  programCount: number
  categories: ContentCategory[]
}> {
  const groups = new Map<string, AspProgramSeed[]>()

  for (const program of ASP_SEED_DATA) {
    if (!groups.has(program.aspName)) {
      groups.set(program.aspName, [])
    }
    groups.get(program.aspName)!.push(program)
  }

  return Array.from(groups.entries()).map(([aspName, programs]) => {
    const rewards: number[] = []
    for (const p of programs) {
      for (const tier of p.rewardTiers) {
        if (tier.type === 'fixed') rewards.push(tier.amount)
      }
    }
    const categories = [...new Set(programs.map((p) => p.category))]

    return {
      aspName,
      minReward: rewards.length > 0 ? Math.min(...rewards) : 0,
      maxReward: rewards.length > 0 ? Math.max(...rewards) : 0,
      programCount: programs.length,
      categories,
    }
  })
}
