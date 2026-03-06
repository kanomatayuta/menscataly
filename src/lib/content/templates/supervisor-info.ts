/**
 * 監修者・参考文献テンプレート
 *
 * E-E-A-T（Experience, Expertise, Authoritativeness, Trustworthiness）対応。
 * YMYL（Your Money or Your Life）コンテンツとして必須の信頼性要素を提供。
 *
 * - getSupervisorTemplate(category): カテゴリ別の監修者情報テンプレート
 * - formatReferences(refs): 参考文献のフォーマット
 * - generateUpdateInfo(): 更新日・免責事項の生成
 */

import type { AuthorInfo, Reference } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** 監修者テンプレート */
export interface SupervisorTemplate {
  /** 監修者情報 */
  supervisor: AuthorInfo
  /** 監修者の専門分野 */
  specialties: string[]
  /** 推奨する監修者タイプ */
  recommendedTypes: string[]
  /** 監修者プロフィールHTML */
  profileHtml: string
  /** 監修者プロフィール構造化データ（JSON-LD） */
  structuredData: Record<string, unknown>
}

/** 参考文献フォーマット済みデータ */
export interface FormattedReference {
  /** 参考文献情報 */
  reference: Reference
  /** フォーマット済みテキスト（APA風） */
  formattedText: string
  /** HTMLリンク付きテキスト */
  htmlText: string
  /** 信頼度レベル */
  trustLevel: 'academic' | 'government' | 'professional' | 'media' | 'other'
}

/** 更新情報テンプレート */
export interface UpdateInfo {
  /** 公開日テキスト */
  publishedAtText: string
  /** 更新日テキスト */
  updatedAtText: string
  /** 情報鮮度注記 */
  freshnessNote: string
  /** 免責事項テキスト */
  disclaimerText: string
  /** 免責事項HTML */
  disclaimerHtml: string
}

// ============================================================
// カテゴリ別 監修者テンプレート定義
// ============================================================

const SUPERVISOR_TEMPLATES: Record<string, SupervisorTemplate> = {
  aga: {
    supervisor: {
      name: '{{SUPERVISOR_NAME}}',
      credentials: '日本皮膚科学会認定 皮膚科専門医',
      bio: '皮膚科専門医として{{YEARS}}年以上の診療経験を持ち、AGA（男性型脱毛症）・薄毛治療を専門とする。{{UNIVERSITY}}大学医学部卒業。日本皮膚科学会、日本毛髪科学協会所属。AGAガイドライン策定にも関与。',
      imageUrl: undefined,
    },
    specialties: ['AGA治療', '男性型脱毛症', '薄毛治療', 'フィナステリド処方', 'ミノキシジル治療'],
    recommendedTypes: ['皮膚科専門医', '毛髪専門医', 'AGA専門クリニック院長'],
    profileHtml: `<div class="supervisor-profile" itemscope itemtype="https://schema.org/Person">
  <div class="supervisor-header">
    <span class="supervisor-badge">医師監修</span>
    <h4 itemprop="name">{{SUPERVISOR_NAME}}</h4>
  </div>
  <p class="supervisor-credentials" itemprop="jobTitle">日本皮膚科学会認定 皮膚科専門医</p>
  <p class="supervisor-bio" itemprop="description">皮膚科専門医として{{YEARS}}年以上の診療経験を持ち、AGA（男性型脱毛症）・薄毛治療を専門としています。</p>
  <ul class="supervisor-affiliations">
    <li itemprop="memberOf">日本皮膚科学会</li>
    <li itemprop="memberOf">日本毛髪科学協会</li>
  </ul>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: '{{SUPERVISOR_NAME}}',
      jobTitle: '皮膚科専門医',
      memberOf: [
        { '@type': 'Organization', name: '日本皮膚科学会' },
        { '@type': 'Organization', name: '日本毛髪科学協会' },
      ],
    },
  },

  ed: {
    supervisor: {
      name: '{{SUPERVISOR_NAME}}',
      credentials: '日本泌尿器科学会認定 泌尿器科専門医',
      bio: '泌尿器科専門医として{{YEARS}}年以上の診療経験を持ち、ED（勃起不全）・メンズヘルス領域を専門とする。{{UNIVERSITY}}大学医学部卒業。日本泌尿器科学会、日本性機能学会所属。',
      imageUrl: undefined,
    },
    specialties: ['ED治療', '勃起不全', 'メンズヘルス', 'PDE5阻害薬処方', '男性更年期'],
    recommendedTypes: ['泌尿器科専門医', 'メンズヘルス専門医', 'ED専門クリニック院長'],
    profileHtml: `<div class="supervisor-profile" itemscope itemtype="https://schema.org/Person">
  <div class="supervisor-header">
    <span class="supervisor-badge">医師監修</span>
    <h4 itemprop="name">{{SUPERVISOR_NAME}}</h4>
  </div>
  <p class="supervisor-credentials" itemprop="jobTitle">日本泌尿器科学会認定 泌尿器科専門医</p>
  <p class="supervisor-bio" itemprop="description">泌尿器科専門医として{{YEARS}}年以上の診療経験を持ち、ED・メンズヘルス領域を専門としています。</p>
  <ul class="supervisor-affiliations">
    <li itemprop="memberOf">日本泌尿器科学会</li>
    <li itemprop="memberOf">日本性機能学会</li>
  </ul>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: '{{SUPERVISOR_NAME}}',
      jobTitle: '泌尿器科専門医',
      memberOf: [
        { '@type': 'Organization', name: '日本泌尿器科学会' },
        { '@type': 'Organization', name: '日本性機能学会' },
      ],
    },
  },

  'hair-removal': {
    supervisor: {
      name: '{{SUPERVISOR_NAME}}',
      credentials: '日本皮膚科学会認定 皮膚科専門医 / 日本レーザー医学会認定レーザー専門医',
      bio: '皮膚科専門医・レーザー専門医として{{YEARS}}年以上の診療経験を持ち、医療レーザー脱毛を専門とする。{{UNIVERSITY}}大学医学部卒業。日本皮膚科学会、日本レーザー医学会、日本美容皮膚科学会所属。',
      imageUrl: undefined,
    },
    specialties: ['医療脱毛', 'レーザー脱毛', '美容皮膚科', 'レーザー治療', 'メンズ脱毛'],
    recommendedTypes: ['皮膚科専門医', 'レーザー専門医', '美容皮膚科医', '脱毛クリニック院長'],
    profileHtml: `<div class="supervisor-profile" itemscope itemtype="https://schema.org/Person">
  <div class="supervisor-header">
    <span class="supervisor-badge">医師監修</span>
    <h4 itemprop="name">{{SUPERVISOR_NAME}}</h4>
  </div>
  <p class="supervisor-credentials" itemprop="jobTitle">皮膚科専門医 / レーザー専門医</p>
  <p class="supervisor-bio" itemprop="description">皮膚科専門医・レーザー専門医として{{YEARS}}年以上の診療経験を持ち、医療レーザー脱毛を専門としています。</p>
  <ul class="supervisor-affiliations">
    <li itemprop="memberOf">日本皮膚科学会</li>
    <li itemprop="memberOf">日本レーザー医学会</li>
    <li itemprop="memberOf">日本美容皮膚科学会</li>
  </ul>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: '{{SUPERVISOR_NAME}}',
      jobTitle: '皮膚科専門医 / レーザー専門医',
      memberOf: [
        { '@type': 'Organization', name: '日本皮膚科学会' },
        { '@type': 'Organization', name: '日本レーザー医学会' },
        { '@type': 'Organization', name: '日本美容皮膚科学会' },
      ],
    },
  },

  skincare: {
    supervisor: {
      name: '{{SUPERVISOR_NAME}}',
      credentials: '日本皮膚科学会認定 皮膚科専門医',
      bio: '皮膚科専門医として{{YEARS}}年以上の診療経験を持ち、ニキビ治療・シミ治療・エイジングケアを専門とする。{{UNIVERSITY}}大学医学部卒業。日本皮膚科学会、日本美容皮膚科学会所属。化粧品の成分・安全性にも精通。',
      imageUrl: undefined,
    },
    specialties: ['スキンケア', 'ニキビ治療', 'シミ治療', 'エイジングケア', '美容皮膚科'],
    recommendedTypes: ['皮膚科専門医', '美容皮膚科医', '化粧品開発研究者'],
    profileHtml: `<div class="supervisor-profile" itemscope itemtype="https://schema.org/Person">
  <div class="supervisor-header">
    <span class="supervisor-badge">医師監修</span>
    <h4 itemprop="name">{{SUPERVISOR_NAME}}</h4>
  </div>
  <p class="supervisor-credentials" itemprop="jobTitle">日本皮膚科学会認定 皮膚科専門医</p>
  <p class="supervisor-bio" itemprop="description">皮膚科専門医として{{YEARS}}年以上の診療経験を持ち、ニキビ治療・シミ治療・エイジングケアを専門としています。</p>
  <ul class="supervisor-affiliations">
    <li itemprop="memberOf">日本皮膚科学会</li>
    <li itemprop="memberOf">日本美容皮膚科学会</li>
  </ul>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: '{{SUPERVISOR_NAME}}',
      jobTitle: '皮膚科専門医',
      memberOf: [
        { '@type': 'Organization', name: '日本皮膚科学会' },
        { '@type': 'Organization', name: '日本美容皮膚科学会' },
      ],
    },
  },

  supplement: {
    supervisor: {
      name: '{{SUPERVISOR_NAME}}',
      credentials: '管理栄養士 / 薬剤師',
      bio: '管理栄養士・薬剤師として{{YEARS}}年以上の栄養指導・服薬指導経験を持つ。{{UNIVERSITY}}薬科大学卒業。日本栄養士会、日本薬剤師会所属。サプリメントの成分・安全性・相互作用に精通。',
      imageUrl: undefined,
    },
    specialties: ['サプリメント', '栄養指導', '服薬指導', '健康食品', '機能性表示食品'],
    recommendedTypes: ['管理栄養士', '薬剤師', 'サプリメントアドバイザー'],
    profileHtml: `<div class="supervisor-profile" itemscope itemtype="https://schema.org/Person">
  <div class="supervisor-header">
    <span class="supervisor-badge">専門家監修</span>
    <h4 itemprop="name">{{SUPERVISOR_NAME}}</h4>
  </div>
  <p class="supervisor-credentials" itemprop="jobTitle">管理栄養士 / 薬剤師</p>
  <p class="supervisor-bio" itemprop="description">管理栄養士・薬剤師として{{YEARS}}年以上の経験を持ち、サプリメントの成分・安全性に精通しています。</p>
  <ul class="supervisor-affiliations">
    <li itemprop="memberOf">日本栄養士会</li>
    <li itemprop="memberOf">日本薬剤師会</li>
  </ul>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: '{{SUPERVISOR_NAME}}',
      jobTitle: '管理栄養士 / 薬剤師',
      memberOf: [
        { '@type': 'Organization', name: '日本栄養士会' },
        { '@type': 'Organization', name: '日本薬剤師会' },
      ],
    },
  },

  column: {
    supervisor: {
      name: '{{SUPERVISOR_NAME}}',
      credentials: '医療ライター / 健康メディア編集者',
      bio: '医療・健康分野の専門ライターとして{{YEARS}}年以上の執筆経験。医療記事の正確性・分かりやすさの両立を追求。必要に応じて各専門医の監修を受ける体制で記事を制作。',
      imageUrl: undefined,
    },
    specialties: ['医療ライティング', 'ヘルスコミュニケーション', 'メンズ美容全般'],
    recommendedTypes: ['医療ライター', '健康メディア編集者', 'メンズ美容ジャーナリスト'],
    profileHtml: `<div class="supervisor-profile" itemscope itemtype="https://schema.org/Person">
  <div class="supervisor-header">
    <span class="supervisor-badge">専門家執筆</span>
    <h4 itemprop="name">{{SUPERVISOR_NAME}}</h4>
  </div>
  <p class="supervisor-credentials" itemprop="jobTitle">医療ライター</p>
  <p class="supervisor-bio" itemprop="description">医療・健康分野の専門ライターとして{{YEARS}}年以上の執筆経験を持ちます。</p>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: '{{SUPERVISOR_NAME}}',
      jobTitle: '医療ライター',
    },
  },
}

// ============================================================
// カテゴリ別 推奨参考文献テンプレート
// ============================================================

const REFERENCE_TEMPLATES: Record<string, Reference[]> = {
  aga: [
    {
      title: '男性型および女性型脱毛症診療ガイドライン 2017年版',
      url: 'https://www.dermatol.or.jp/uploads/uploads/files/guideline/AGA_GL2017.pdf',
      source: '日本皮膚科学会',
      year: 2017,
    },
    {
      title: 'Finasteride in the treatment of men with androgenetic alopecia',
      url: 'https://pubmed.ncbi.nlm.nih.gov/9777765/',
      author: 'Kaufman KD, et al.',
      source: 'J Am Acad Dermatol',
      year: 1998,
    },
    {
      title: 'プロペシア錠 添付文書',
      url: 'https://www.pmda.go.jp/',
      source: 'PMDA（医薬品医療機器総合機構）',
    },
    {
      title: 'Minoxidil use in dermatology, side effects and recent patents',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24890581/',
      author: 'Suchonwanit P, et al.',
      source: 'Recent Pat Inflamm Allergy Drug Discov',
      year: 2014,
    },
  ],
  ed: [
    {
      title: 'ED診療ガイドライン 第3版',
      url: 'https://www.urol.or.jp/',
      source: '日本泌尿器科学会',
      year: 2018,
    },
    {
      title: 'バイアグラ錠 添付文書',
      url: 'https://www.pmda.go.jp/',
      source: 'PMDA（医薬品医療機器総合機構）',
    },
    {
      title: 'シアリス錠 添付文書',
      url: 'https://www.pmda.go.jp/',
      source: 'PMDA（医薬品医療機器総合機構）',
    },
    {
      title: 'Sildenafil citrate therapy for erectile dysfunction',
      url: 'https://pubmed.ncbi.nlm.nih.gov/9517093/',
      author: 'Goldstein I, et al.',
      source: 'N Engl J Med',
      year: 1998,
    },
  ],
  'hair-removal': [
    {
      title: 'レーザー脱毛に関する安全管理基準',
      url: 'https://www.jslsm.gr.jp/',
      source: '日本レーザー医学会',
    },
    {
      title: '脱毛サービスに関する消費者庁注意喚起',
      url: 'https://www.caa.go.jp/',
      source: '消費者庁',
      year: 2017,
    },
    {
      title: 'Laser hair removal: a review',
      url: 'https://pubmed.ncbi.nlm.nih.gov/16399612/',
      author: 'Haedersdal M, Wulf HC.',
      source: 'Dermatol Surg',
      year: 2006,
    },
  ],
  skincare: [
    {
      title: '尋常性痤瘡治療ガイドライン 2017',
      url: 'https://www.dermatol.or.jp/',
      source: '日本皮膚科学会',
      year: 2017,
    },
    {
      title: '化粧品の効能の範囲について',
      url: 'https://www.mhlw.go.jp/',
      source: '厚生労働省',
    },
    {
      title: 'Retinoids in the treatment of skin aging',
      url: 'https://pubmed.ncbi.nlm.nih.gov/17515510/',
      author: 'Mukherjee S, et al.',
      source: 'Clin Interv Aging',
      year: 2006,
    },
    {
      title: '紫外線環境保健マニュアル',
      url: 'https://www.env.go.jp/',
      source: '環境省',
      year: 2020,
    },
  ],
  supplement: [
    {
      title: '日本人の食事摂取基準（2020年版）',
      url: 'https://www.mhlw.go.jp/',
      source: '厚生労働省',
      year: 2020,
    },
    {
      title: '健康食品の安全性・有効性情報',
      url: 'https://hfnet.nibiohn.go.jp/',
      source: '国立健康・栄養研究所',
    },
    {
      title: '機能性表示食品に関する情報',
      url: 'https://www.caa.go.jp/policies/policy/food_labeling/foods_with_function_claims/',
      source: '消費者庁',
    },
    {
      title: '医薬品との相互作用情報',
      url: 'https://www.pmda.go.jp/',
      source: 'PMDA（医薬品医療機器総合機構）',
    },
  ],
  column: [
    {
      title: '医療広告ガイドライン',
      url: 'https://www.mhlw.go.jp/',
      source: '厚生労働省',
      year: 2018,
    },
    {
      title: 'オンライン診療の適切な実施に関する指針',
      url: 'https://www.mhlw.go.jp/',
      source: '厚生労働省',
      year: 2022,
    },
  ],
}

// ============================================================
// 信頼度レベル判定
// ============================================================

/**
 * 参考文献の信頼度レベルを判定する
 */
function determineTrustLevel(
  ref: Reference
): FormattedReference['trustLevel'] {
  const source = (ref.source ?? '').toLowerCase()
  const url = ref.url.toLowerCase()

  // 学術論文
  if (
    url.includes('pubmed') ||
    url.includes('doi.org') ||
    url.includes('ncbi.nlm.nih.gov') ||
    source.includes('journal') ||
    source.includes('j am') ||
    source.includes('n engl j med')
  ) {
    return 'academic'
  }

  // 政府機関・公的機関
  if (
    url.includes('.go.jp') ||
    url.includes('.gov') ||
    source.includes('厚生労働省') ||
    source.includes('消費者庁') ||
    source.includes('環境省') ||
    source.includes('PMDA') ||
    source.includes('医薬品医療機器総合機構')
  ) {
    return 'government'
  }

  // 学会・専門機関
  if (
    source.includes('学会') ||
    source.includes('協会') ||
    source.includes('研究所') ||
    url.includes('.or.jp')
  ) {
    return 'professional'
  }

  // メディア
  if (
    source.includes('新聞') ||
    source.includes('ニュース') ||
    source.includes('メディア')
  ) {
    return 'media'
  }

  return 'other'
}

// ============================================================
// メイン関数
// ============================================================

/**
 * カテゴリ別の監修者テンプレートを取得する
 *
 * @param category コンテンツカテゴリ（ContentCategory | 'supplement' | 'comparison'）
 * @returns 監修者テンプレート
 *
 * @example
 * ```ts
 * const template = getSupervisorTemplateForCategory('aga');
 * console.log(template.supervisor.credentials); // "日本皮膚科学会認定 皮膚科専門医"
 * ```
 */
export function getSupervisorTemplateForCategory(
  category: string
): SupervisorTemplate {
  // supplement と comparison は対応するテンプレートにマッピング
  const mappedCategory =
    category === 'comparison' ? 'column' : category

  return (
    SUPERVISOR_TEMPLATES[mappedCategory] ?? SUPERVISOR_TEMPLATES['column']
  )
}

/**
 * 参考文献をフォーマットする
 *
 * 参考文献リストをAPA風のフォーマットに整形し、
 * 信頼度レベルの付与とHTMLリンク付きテキストを生成する。
 *
 * @param refs 参考文献リスト
 * @returns フォーマット済み参考文献リスト（信頼度の高い順）
 *
 * @example
 * ```ts
 * const formatted = formatReferences([
 *   { title: 'AGA診療ガイドライン', url: '...', source: '日本皮膚科学会', year: 2017 },
 * ]);
 * formatted.forEach(ref => {
 *   console.log(ref.formattedText);
 *   console.log(`信頼度: ${ref.trustLevel}`);
 * });
 * ```
 */
export function formatReferences(refs: Reference[]): FormattedReference[] {
  const trustLevelOrder: Record<FormattedReference['trustLevel'], number> = {
    academic: 1,
    government: 2,
    professional: 3,
    media: 4,
    other: 5,
  }

  return refs
    .map((ref) => {
      const trustLevel = determineTrustLevel(ref)

      // APA風フォーマット
      const parts: string[] = []
      if (ref.author) parts.push(ref.author)
      if (ref.year) parts.push(`(${ref.year})`)
      parts.push(ref.title)
      if (ref.source) parts.push(ref.source)
      const formattedText = parts.join('. ') + '.'

      // HTMLリンク付き
      const htmlText = `<li class="reference-item" data-trust="${trustLevel}">
  <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.title}</a>
  ${ref.author ? `<span class="ref-author">${ref.author}</span>` : ''}
  ${ref.source ? `<span class="ref-source">${ref.source}</span>` : ''}
  ${ref.year ? `<span class="ref-year">(${ref.year})</span>` : ''}
</li>`

      return {
        reference: ref,
        formattedText,
        htmlText,
        trustLevel,
      }
    })
    .sort((a, b) => trustLevelOrder[a.trustLevel] - trustLevelOrder[b.trustLevel])
}

/**
 * 更新情報・免責事項を生成する
 *
 * 記事に必須の日付情報と免責事項テンプレートを生成する。
 *
 * @param publishedAt 公開日（ISO 8601 形式、デフォルト: 現在日時）
 * @param updatedAt 更新日（ISO 8601 形式、デフォルト: 現在日時）
 * @param category カテゴリ（免責事項のカスタマイズ用）
 * @returns 更新情報テンプレート
 *
 * @example
 * ```ts
 * const info = generateUpdateInfo('2025-01-15', '2025-03-01', 'aga');
 * console.log(info.freshnessNote);
 * // "※本記事の情報は2025年3月時点のものです。最新情報は公式サイト・医療機関でご確認ください。"
 * ```
 */
export function generateUpdateInfo(
  publishedAt?: string,
  updatedAt?: string,
  category?: string
): UpdateInfo {
  const now = new Date()
  const pubDate = publishedAt ? new Date(publishedAt) : now
  const updDate = updatedAt ? new Date(updatedAt) : now

  const formatDate = (d: Date): string => {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  const formatYearMonth = (d: Date): string => {
    return `${d.getFullYear()}年${d.getMonth() + 1}月`
  }

  const publishedAtText = `公開日: ${formatDate(pubDate)}`
  const updatedAtText = `最終更新日: ${formatDate(updDate)}`
  const freshnessNote = `※本記事の情報は${formatYearMonth(updDate)}時点のものです。最新情報は公式サイト・医療機関でご確認ください。`

  // カテゴリ別の免責事項
  let categoryDisclaimer = ''
  switch (category) {
    case 'aga':
    case 'ed':
      categoryDisclaimer =
        '本記事で紹介している治療法・医薬品の情報は、医師の診察・指導のもとで行う治療の参考情報として提供しています。自己判断での治療開始・変更・中止は避け、必ず医師にご相談ください。'
      break
    case 'hair-removal':
      categoryDisclaimer =
        '本記事で紹介している脱毛施術の効果には個人差があります。施術を検討される場合は、事前にクリニックでカウンセリングを受けることをお勧めします。'
      break
    case 'skincare':
      categoryDisclaimer =
        '本記事で紹介している化粧品・スキンケア商品の効果には個人差があります。肌に異常を感じた場合は使用を中止し、皮膚科専門医にご相談ください。'
      break
    case 'supplement':
      categoryDisclaimer =
        'サプリメントは医薬品ではありません。効果には個人差があります。持病のある方や薬を服用中の方は、使用前に医師・薬剤師にご相談ください。食事からの栄養摂取が基本です。'
      break
    default:
      categoryDisclaimer =
        '本記事の情報は一般的な情報提供を目的としており、医療行為に代わるものではありません。'
  }

  const disclaimerText = `【免責事項】\n${categoryDisclaimer}\n※本記事はアフィリエイト広告（PR）を含みます。記事内のリンクから商品・サービスを購入・申込すると、当サイトに報酬が支払われる場合があります。\n${freshnessNote}`

  const disclaimerHtml = `<div class="disclaimer-box">
  <h4>免責事項</h4>
  <p>${categoryDisclaimer}</p>
  <p class="pr-disclosure">※本記事はアフィリエイト広告（PR）を含みます。記事内のリンクから商品・サービスを購入・申込すると、当サイトに報酬が支払われる場合があります。</p>
  <p class="freshness-note">${freshnessNote}</p>
</div>`

  return {
    publishedAtText,
    updatedAtText,
    freshnessNote,
    disclaimerText,
    disclaimerHtml,
  }
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * カテゴリ別の推奨参考文献を取得する
 *
 * @param category カテゴリ
 * @returns 推奨参考文献リスト
 */
export function getRecommendedReferencesForCategory(
  category: string
): Reference[] {
  const mappedCategory = category === 'comparison' ? 'column' : category
  return [...(REFERENCE_TEMPLATES[mappedCategory] ?? REFERENCE_TEMPLATES['column'] ?? [])]
}

/**
 * 記事に必要な参考文献数の目安を取得する
 *
 * @param category カテゴリ
 * @returns 最低推奨参考文献数
 */
export function getMinimumReferenceCount(category: string): number {
  switch (category) {
    case 'aga':
    case 'ed':
      return 4 // 医療系は最低4件
    case 'hair-removal':
    case 'skincare':
      return 3 // 美容系は最低3件
    case 'supplement':
      return 3 // サプリ系は最低3件
    default:
      return 2 // コラム等は最低2件
  }
}

/**
 * 全カテゴリの監修者テンプレートを取得する
 */
export function getAllSupervisorTemplates(): Record<string, SupervisorTemplate> {
  return { ...SUPERVISOR_TEMPLATES }
}
