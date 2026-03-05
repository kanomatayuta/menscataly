/**
 * クリニック比較記事テンプレート
 *
 * 比較記事のセクション構成・ASP CTA配置・料金比較表・
 * 星評価データ構造を定義する。
 *
 * 薬機法第66条・67条準拠
 * 景表法・ステマ規制対応
 */

import type { ContentCategory } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** クリニック情報 */
export interface ClinicInfo {
  /** クリニックID */
  id: string
  /** クリニック名 */
  name: string
  /** 一言説明（30文字以内） */
  shortDescription: string
  /** 特徴リスト（3〜5項目） */
  features: string[]
  /** 公式サイトURL */
  officialUrl: string
  /** アフィリエイトURL */
  affiliateUrl?: string
  /** ASP名 */
  aspName?: string
  /** ロゴ画像URL */
  logoUrl?: string
  /** 対応地域（全国 / 東京 等） */
  coverage: string
  /** オンライン診療対応 */
  hasOnlineConsultation: boolean
  /** 初回カウンセリング無料 */
  hasFreeConsultation: boolean
}

/** 料金プラン */
export interface PricePlan {
  /** プラン名 */
  planName: string
  /** 月額料金（税込、円） */
  monthlyPrice: number
  /** 初期費用（税込、円） */
  initialCost: number
  /** 含まれる施術・薬 */
  includes: string[]
  /** 割引情報 */
  discount?: string
  /** 価格調査日 */
  priceAsOf: string
}

/** クリニック料金比較データ */
export interface ClinicPriceComparison {
  /** クリニック情報 */
  clinic: ClinicInfo
  /** 料金プラン */
  plans: PricePlan[]
  /** 最安月額 */
  lowestMonthlyPrice: number
}

/** 星評価 */
export interface StarRating {
  /** 評価カテゴリ */
  category: string
  /** スコア（1.0 - 5.0） */
  score: number
  /** 根拠（調査方法や情報源） */
  basis: string
}

/** クリニック評価データ */
export interface ClinicRating {
  /** クリニック情報 */
  clinic: ClinicInfo
  /** 総合評価 */
  overallScore: number
  /** カテゴリ別評価 */
  ratings: StarRating[]
  /** メリット */
  pros: string[]
  /** デメリット */
  cons: string[]
  /** こんな人におすすめ */
  recommendedFor: string[]
}

/** CTA配置ポイント（比較記事用） */
export interface ComparisonCtaPosition {
  /** 配置場所の説明 */
  placement: string
  /** 配置するセクションインデックス */
  afterSectionIndex: number
  /** CTA種別 */
  variant: 'primary' | 'secondary' | 'comparison-table'
  /** 対象クリニック数（0=全クリニック） */
  targetClinicCount: number
}

/** 比較記事セクション定義 */
export interface ComparisonSectionDef {
  /** セクションID */
  id: string
  /** 見出しテキスト */
  heading: string
  /** 見出しレベル */
  level: 'h2' | 'h3'
  /** セクション概要（執筆指示） */
  description: string
  /** サブセクション */
  subsections?: ComparisonSectionDef[]
  /** E-E-A-T要素 */
  eeatElements?: string[]
  /** コンプライアンス注記 */
  complianceNotes?: string[]
}

/** 比較記事テンプレート */
export interface ComparisonArticleTemplate {
  /** テンプレート名 */
  name: string
  /** 対象カテゴリ */
  categories: (ContentCategory | 'supplement')[]
  /** PR表記テンプレート */
  prDisclosure: string
  /** 目標文字数 */
  targetWordCount: number
  /** セクション構成 */
  sections: ComparisonSectionDef[]
  /** CTA配置ポイント */
  ctaPositions: ComparisonCtaPosition[]
  /** 評価カテゴリ（星評価用） */
  ratingCategories: string[]
  /** コンプライアンスルール */
  globalComplianceRules: string[]
  /** E-E-A-Tチェックリスト */
  eeatChecklist: string[]
}

// ============================================================
// 評価カテゴリ定義（カテゴリ別）
// ============================================================

/** カテゴリ別の星評価基準 */
export const RATING_CATEGORIES: Record<string, string[]> = {
  aga: ['費用', '治療実績', '医師の質', 'オンライン対応', 'アクセス', '口コミ評判'],
  ed: ['費用', 'プライバシー配慮', '処方スピード', 'オンライン対応', '取扱い薬の種類', '口コミ評判'],
  'hair-removal': ['費用', '機器の質', '痛み対策', '予約の取りやすさ', 'アクセス', '口コミ評判'],
  skincare: ['費用', '施術メニュー', 'カウンセリング品質', 'アフターケア', 'アクセス', '口コミ評判'],
  supplement: ['価格', '成分配合', 'エビデンス', '飲みやすさ', 'コスパ', '口コミ評判'],
}

// ============================================================
// 比較記事テンプレート定義
// ============================================================

export const COMPARISON_ARTICLE_TEMPLATE: ComparisonArticleTemplate = {
  name: 'クリニック比較記事テンプレート',
  categories: ['aga', 'ed', 'hair-removal', 'skincare'],
  prDisclosure:
    '※本記事はアフィリエイト広告（PR）を含みます。記事内で紹介しているクリニック情報やリンクにはPRが含まれています。料金は調査時点のものであり、最新情報は各クリニック公式サイトでご確認ください。',
  targetWordCount: 6000,

  sections: [
    // セクション 0: 導入
    {
      id: 'comp-intro',
      heading: '導入・リード文',
      level: 'h2',
      description:
        '読者の悩み・検索意図に寄り添いつつ、この記事の比較対象・評価基準を明示。PR表記を冒頭に配置。記事の信頼性（監修情報、調査方法）を早期に提示。',
      eeatElements: [
        '監修者情報を冒頭に記載',
        '比較調査の方法論（調査日、調査対象、評価基準）を明示',
        '記事の公開日・最終更新日を表示',
      ],
      complianceNotes: [
        'PR表記を必ず冒頭に挿入（ステマ規制対応）',
        '料金情報の調査日を明記（「※〇〇年〇〇月時点の料金です」）',
      ],
    },

    // セクション 1: 比較表（一覧）
    {
      id: 'comp-table',
      heading: '【比較表】おすすめクリニック一覧',
      level: 'h2',
      description:
        '全クリニックの主要情報を一覧表形式で提示。読者がスクロールせず概要を把握できるようにする。各クリニックの公式サイトリンク（アフィリエイトリンク）を設置。',
      subsections: [
        {
          id: 'comp-table-criteria',
          heading: '評価基準の説明',
          level: 'h3',
          description: '比較に使用した評価基準（費用、実績、対応エリア等）を客観的に解説',
        },
        {
          id: 'comp-table-overview',
          heading: '比較表',
          level: 'h3',
          description: 'クリニック名・月額費用・特徴・対応エリア・オンライン対応の一覧表',
        },
      ],
      complianceNotes: [
        '特定クリニックを不当に優遇しない客観的な基準で比較',
        '「No.1」「最安値」等の表現には調査根拠・日時が必要',
        'アフィリエイトリンクには rel="sponsored noopener" を付与',
      ],
    },

    // セクション 2: 各クリニック詳細
    {
      id: 'comp-details',
      heading: '各クリニック詳細レビュー',
      level: 'h2',
      description:
        '各クリニックの詳細情報を個別セクションで解説。星評価・メリット・デメリット・料金プラン・口コミ情報を含む。1クリニックあたり500〜800文字を目安に記述。',
      subsections: [
        {
          id: 'comp-clinic-detail',
          heading: '【クリニック名】の詳細',
          level: 'h3',
          description:
            '星評価（総合＋カテゴリ別）、特徴、料金プラン、メリット・デメリット、こんな人におすすめ、公式サイトリンクを記載。各クリニックごとにこのセクションを繰り返す。',
        },
      ],
      eeatElements: [
        '料金情報の出典（公式サイトの参照URL）を明記',
        '口コミ情報には出典・投稿日を付記',
      ],
      complianceNotes: [
        '口コミは「個人の感想であり、効果を保証するものではありません」と注記',
        '体験談の掲載は医療広告ガイドラインに準拠',
        'メリット・デメリットを公平に記載（メリットのみの記載は不可）',
      ],
    },

    // セクション 3: 選び方ガイド
    {
      id: 'comp-guide',
      heading: '失敗しないクリニックの選び方',
      level: 'h2',
      description:
        '読者が自分に合ったクリニックを選ぶための判断基準を5〜7ポイントで解説。目的別（費用重視・実績重視・利便性重視等）の推奨を提示。',
      subsections: [
        {
          id: 'comp-guide-point1',
          heading: '費用で選ぶ場合のポイント',
          level: 'h3',
          description: '月額費用だけでなく総額・初期費用・追加費用の比較方法を解説',
        },
        {
          id: 'comp-guide-point2',
          heading: '実績・信頼性で選ぶ場合のポイント',
          level: 'h3',
          description: '医師の資格、症例数、学会所属等の確認ポイントを解説',
        },
        {
          id: 'comp-guide-point3',
          heading: 'オンライン診療 vs 対面診療の選び方',
          level: 'h3',
          description: 'それぞれのメリット・デメリットと向いている人の特徴',
        },
        {
          id: 'comp-guide-point4',
          heading: '目的・予算別のおすすめ',
          level: 'h3',
          description: '読者のニーズ別（コスパ重視・確実性重視・時間重視）に推奨クリニックを提案',
        },
      ],
      eeatElements: [
        '厚生労働省の医療広告ガイドラインを参考情報として引用',
        '選び方の根拠となるデータや統計を提示',
      ],
    },

    // セクション 4: 料金比較
    {
      id: 'comp-price',
      heading: '料金比較表',
      level: 'h2',
      description:
        '全クリニックの料金プランを詳細に比較。月額料金・初期費用・年間総額を表形式で提示。割引情報やキャンペーンも含める。',
      subsections: [
        {
          id: 'comp-price-monthly',
          heading: '月額料金の比較',
          level: 'h3',
          description: '治療内容別の月額料金一覧表',
        },
        {
          id: 'comp-price-total',
          heading: '年間総額の比較',
          level: 'h3',
          description: '初期費用＋月額×12ヶ月の年間コスト比較',
        },
        {
          id: 'comp-price-tips',
          heading: '費用を抑えるコツ',
          level: 'h3',
          description: 'キャンペーン・セットプラン・オンライン割引等の節約方法',
        },
      ],
      complianceNotes: [
        '料金には必ず「税込」を明記',
        '料金の調査日を必ず付記（「※〇〇年〇〇月〇〇日時点の価格です」）',
        '「最安値」表現には調査条件・日時の明記が必須',
      ],
    },

    // セクション 5: 口コミ・評判
    {
      id: 'comp-reviews',
      heading: '口コミ・評判まとめ',
      level: 'h2',
      description:
        '各クリニックの口コミ・評判を整理。良い口コミ・悪い口コミの両方をバランスよく紹介。情報源を明記。',
      subsections: [
        {
          id: 'comp-reviews-good',
          heading: '良い口コミの傾向',
          level: 'h3',
          description: '複数の口コミサイトから良い評価の傾向を抽出',
        },
        {
          id: 'comp-reviews-bad',
          heading: '注意すべき口コミの傾向',
          level: 'h3',
          description: '改善希望やネガティブな評価の傾向を客観的に紹介',
        },
      ],
      complianceNotes: [
        '口コミには「※個人の感想です。効果には個人差があります。」を付記',
        '口コミの出典（Googleマップ、みん評等）と投稿時期を明記',
        '作為的な口コミの選別（良い口コミのみ）は景表法・ステマ規制に抵触',
      ],
    },

    // セクション 6: まとめ
    {
      id: 'comp-summary',
      heading: 'まとめ',
      level: 'h2',
      description:
        '比較結果の要約と、読者のニーズ別に最適なクリニックを3〜5パターンで提案。メインCTAを配置。',
      eeatElements: [
        '監修者の最終コメントを掲載',
        '参考文献・情報源リストを記事末尾に配置',
        '最終更新日を再表示',
      ],
      complianceNotes: [
        'まとめのCTAでも断定表現・過度な購買圧力を避ける',
        '「今すぐ申し込まないと損」等の表現は景表法違反',
      ],
    },
  ],

  ctaPositions: [
    {
      placement: '比較表の直後（全クリニックへの導線）',
      afterSectionIndex: 1,
      variant: 'comparison-table',
      targetClinicCount: 0, // 全クリニック
    },
    {
      placement: '各クリニック詳細セクション内（個別クリニックCTA）',
      afterSectionIndex: 2,
      variant: 'secondary',
      targetClinicCount: 1, // 各クリニック個別
    },
    {
      placement: '選び方ガイドの後（再度比較表参照を促す）',
      afterSectionIndex: 3,
      variant: 'secondary',
      targetClinicCount: 3, // 上位3クリニック
    },
    {
      placement: '料金比較表の後（最安クリニックCTA）',
      afterSectionIndex: 4,
      variant: 'primary',
      targetClinicCount: 3, // 最安上位3クリニック
    },
    {
      placement: 'まとめセクション（メインCTA）',
      afterSectionIndex: 6,
      variant: 'primary',
      targetClinicCount: 3, // 総合おすすめ上位3
    },
  ],

  ratingCategories: ['費用', '実績', '医師の質', 'オンライン対応', 'アクセス', '口コミ'],

  globalComplianceRules: [
    '薬機法第66条: 効果・安全性の断定表現禁止',
    '薬機法第67条: 医療用医薬品の一般向け広告規制に留意',
    '景表法: 最大級表現（No.1、最安値等）には第三者調査の根拠・日時が必須',
    'ステマ規制: 記事冒頭にPR表記を挿入、全アフィリエイトリンクに rel="sponsored" を付与',
    '医療広告ガイドライン: 体験談の掲載は原則禁止（掲載する場合は適切な注記が必要）',
    '料金表示は税込表記を徹底、調査日時を必ず付記',
    '特定クリニックを不当に優遇する順位操作の禁止',
    '口コミは良い・悪いの両方をバランスよく掲載',
  ],

  eeatChecklist: [
    '監修者情報（氏名・資格・経歴）が記事冒頭に記載されているか',
    '比較の評価基準が客観的に明示されているか',
    '料金情報の調査日が全箇所に付記されているか',
    '参考文献（公式サイト・学会ガイドライン等）が記載されているか',
    '口コミの出典と投稿時期が明記されているか',
    'PR表記が記事冒頭に含まれているか',
    '公開日・最終更新日が明記されているか',
    'FAQ Schemaに対応した構造化データが含まれているか',
  ],
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * カテゴリ別の比較記事テンプレートを取得する
 *
 * 基本テンプレートをベースに、カテゴリ固有の評価カテゴリを適用して返す。
 *
 * @param category コンテンツカテゴリ
 * @returns カテゴリ別にカスタマイズされた比較記事テンプレート
 */
export function getComparisonTemplate(
  category: ContentCategory | 'supplement'
): ComparisonArticleTemplate {
  const categoryRatings = RATING_CATEGORIES[category] ?? RATING_CATEGORIES['aga']

  return {
    ...COMPARISON_ARTICLE_TEMPLATE,
    ratingCategories: categoryRatings,
  }
}

/**
 * 料金比較テーブルのHTMLを生成する
 *
 * @param comparisons クリニック料金比較データの配列
 * @param priceAsOf 料金調査日（ISO 8601）
 * @returns 料金比較テーブルHTML
 */
export function generatePriceComparisonTableHtml(
  comparisons: ClinicPriceComparison[],
  priceAsOf: string
): string {
  const dateStr = new Date(priceAsOf).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // 最安順にソート
  const sorted = [...comparisons].sort(
    (a, b) => a.lowestMonthlyPrice - b.lowestMonthlyPrice
  )

  const rows = sorted
    .map((comp) => {
      const plans = comp.plans
        .map(
          (p) =>
            `<li>${p.planName}: 月額${p.monthlyPrice.toLocaleString()}円（税込）</li>`
        )
        .join('')

      return `<tr>
    <td>${comp.clinic.name}</td>
    <td>${comp.lowestMonthlyPrice.toLocaleString()}円〜</td>
    <td><ul>${plans}</ul></td>
    <td>${comp.clinic.hasOnlineConsultation ? '対応' : '非対応'}</td>
    <td>${comp.clinic.hasFreeConsultation ? '無料' : '有料'}</td>
    <td><a href="${comp.clinic.affiliateUrl ?? comp.clinic.officialUrl}" rel="sponsored noopener" target="_blank">公式サイト</a></td>
  </tr>`
    })
    .join('\n  ')

  return `<div class="price-comparison-table">
  <p class="price-note">※料金は${dateStr}時点のものです。最新の料金は各クリニック公式サイトでご確認ください。すべて税込表記です。</p>
  <table>
    <thead>
      <tr>
        <th>クリニック名</th>
        <th>月額料金</th>
        <th>プラン詳細</th>
        <th>オンライン診療</th>
        <th>初回カウンセリング</th>
        <th>公式サイト</th>
      </tr>
    </thead>
    <tbody>
  ${rows}
    </tbody>
  </table>
</div>`
}

/**
 * 星評価コンポーネントのデータを生成する
 *
 * @param clinicRatings クリニック評価データの配列
 * @returns 星評価表示用のデータ構造
 */
export function generateStarRatingData(
  clinicRatings: ClinicRating[]
): Array<{
  clinicName: string
  overallScore: number
  overallStars: string
  categoryRatings: Array<{
    category: string
    score: number
    stars: string
    basis: string
  }>
  pros: string[]
  cons: string[]
  recommendedFor: string[]
}> {
  return clinicRatings.map((cr) => ({
    clinicName: cr.clinic.name,
    overallScore: cr.overallScore,
    overallStars: generateStarString(cr.overallScore),
    categoryRatings: cr.ratings.map((r) => ({
      category: r.category,
      score: r.score,
      stars: generateStarString(r.score),
      basis: r.basis,
    })),
    pros: cr.pros,
    cons: cr.cons,
    recommendedFor: cr.recommendedFor,
  }))
}

/**
 * スコアから星文字列を生成する
 *
 * @param score 1.0 - 5.0
 * @returns 星文字列（例: "4.5"）
 */
function generateStarString(score: number): string {
  const clampedScore = Math.max(1, Math.min(5, score))
  return clampedScore.toFixed(1)
}

/**
 * クリニック比較記事のCTAテキストを生成する
 *
 * @param clinicName クリニック名
 * @param category カテゴリ
 * @returns CTA文言
 */
export function generateComparisonCta(
  clinicName: string,
  category: ContentCategory | 'supplement'
): { primaryText: string; secondaryText: string; buttonText: string } {
  const categoryAction: Record<string, string> = {
    aga: '無料カウンセリング',
    ed: 'オンライン診療',
    'hair-removal': '無料カウンセリング',
    skincare: '肌診断・カウンセリング',
    supplement: '詳細',
    column: '詳細',
  }

  const action = categoryAction[category] ?? '詳細'

  return {
    primaryText: `${clinicName}の${action}を予約して、まずは専門家に相談してみませんか？`,
    secondaryText: `${clinicName}の料金プラン・サービス詳細は公式サイトでご確認ください。`,
    buttonText: `${clinicName}の${action}を見る`,
  }
}

/**
 * 比較記事の構造化データ（JSON-LD）を生成する
 *
 * @param title 記事タイトル
 * @param clinicRatings 各クリニックの評価データ
 * @param category カテゴリ
 * @returns JSON-LD 構造化データ
 */
export function generateComparisonJsonLd(
  title: string,
  clinicRatings: ClinicRating[],
  category: ContentCategory | 'supplement'
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://menscataly.com'
  const isMedical = ['aga', 'ed', 'hair-removal'].includes(category)

  return {
    '@context': 'https://schema.org',
    '@type': isMedical ? 'MedicalWebPage' : 'Article',
    headline: title,
    author: {
      '@type': 'Organization',
      name: 'メンズカタリ編集部',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'メンズカタリ',
      url: baseUrl,
      logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.svg` },
    },
    about: clinicRatings.map((cr) => ({
      '@type': 'MedicalClinic',
      name: cr.clinic.name,
      url: cr.clinic.officialUrl,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: cr.overallScore.toFixed(1),
        bestRating: '5',
        worstRating: '1',
        ratingCount: cr.ratings.length,
      },
    })),
  }
}
