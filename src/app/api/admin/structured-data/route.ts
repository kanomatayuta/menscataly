/**
 * /api/admin/structured-data
 * POST: 記事の構造化データを検証（MedicalWebPage, FAQ, Article 等の必須フィールドチェック）
 * GET:  指定記事の構造化データプレビューを生成
 *
 * YMYL/E-E-A-T に必要な構造化データの検証・生成を行い、
 * Google リッチリザルト対応を支援する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { ContentCategory } from '@/types/content'
import type { MicroCMSArticle } from '@/types/microcms'

// ============================================================
// 型定義
// ============================================================

/** 構造化データの種類 */
type StructuredDataType =
  | 'Article'
  | 'MedicalWebPage'
  | 'FAQPage'
  | 'BreadcrumbList'
  | 'Product'
  | 'Review'
  | 'HowTo'
  | 'WebPage'

/** バリデーション結果の個別エラー */
interface ValidationError {
  /** エラーレベル */
  level: 'error' | 'warning' | 'info'
  /** 対象のスキーマタイプ */
  schemaType: StructuredDataType
  /** エラーが発生したフィールド */
  field: string
  /** エラーメッセージ */
  message: string
  /** 推奨される修正内容 */
  suggestion?: string
}

/** バリデーション結果 */
interface ValidationResult {
  /** バリデーション合格かどうか */
  valid: boolean
  /** 全体スコア (0-100) */
  score: number
  /** 検出されたエラー・警告 */
  errors: ValidationError[]
  /** 検証対象のスキーマタイプ */
  checkedTypes: StructuredDataType[]
  /** 推奨される構造化データタイプ */
  recommendedTypes: StructuredDataType[]
}

/** 構造化データプレビュー */
interface StructuredDataPreview {
  /** 記事ID */
  articleId: string
  /** 記事タイトル */
  articleTitle: string
  /** 生成された構造化データ (JSON-LD) */
  jsonLd: Record<string, unknown>
  /** 適用されたスキーマタイプ */
  appliedTypes: StructuredDataType[]
  /** カテゴリ */
  category: ContentCategory | string
}

// ============================================================
// カテゴリ別スキーマタイプマッピング
// ============================================================

const CATEGORY_SCHEMA_MAP: Record<string, StructuredDataType[]> = {
  aga: ['MedicalWebPage', 'Article', 'FAQPage', 'BreadcrumbList'],
  ed: ['MedicalWebPage', 'Article', 'FAQPage', 'BreadcrumbList'],
  'hair-removal': ['MedicalWebPage', 'Article', 'FAQPage', 'BreadcrumbList'],
  skincare: ['Article', 'FAQPage', 'HowTo', 'BreadcrumbList'],
  supplement: ['Article', 'FAQPage', 'BreadcrumbList'],
  column: ['Article', 'BreadcrumbList'],
}

// ============================================================
// 必須フィールド定義
// ============================================================

const REQUIRED_FIELDS: Record<StructuredDataType, string[]> = {
  Article: [
    'headline',
    'datePublished',
    'dateModified',
    'author',
    'publisher',
    'description',
    'mainEntityOfPage',
  ],
  MedicalWebPage: [
    'headline',
    'datePublished',
    'dateModified',
    'author',
    'publisher',
    'description',
    'mainEntityOfPage',
    'about',
    'lastReviewed',
    'reviewedBy',
  ],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
  Product: ['name', 'description', 'offers'],
  Review: ['itemReviewed', 'author', 'reviewRating'],
  HowTo: ['name', 'step'],
  WebPage: ['name', 'description', 'url'],
}

// ============================================================
// モックデータ
// ============================================================

function getMockArticle(articleId: string): MicroCMSArticle | null {
  const mockArticles: Record<string, MicroCMSArticle> = {
    'article-001': {
      id: 'article-001',
      title: 'AGA治療の費用相場と選び方ガイド',
      slug: 'aga-treatment-cost-guide',
      content: '<p>AGA治療の費用について解説します。</p><h2>よくある質問</h2><h3>Q. AGA治療はいくらかかる？</h3><p>A. 月額3,000円から始められます。</p>',
      excerpt: 'AGA治療の費用相場を徹底解説。クリニック選びのポイントも紹介。',
      category: {
        id: 'aga',
        name: 'AGA・薄毛',
        slug: 'aga',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        publishedAt: '2026-01-01T00:00:00Z',
        revisedAt: '2026-01-01T00:00:00Z',
      },
      author_name: 'MENS CATALY 編集部',
      supervisor_name: '田中太郎',
      supervisor_creds: '日本皮膚科学会認定 皮膚科専門医',
      supervisor_bio: '皮膚科専門医として15年以上の診療経験を持つ。',
      is_pr: true,
      compliance_score: 95,
      createdAt: '2026-01-15T09:00:00Z',
      updatedAt: '2026-03-01T09:00:00Z',
      publishedAt: '2026-01-15T09:00:00Z',
      revisedAt: '2026-03-01T09:00:00Z',
    },
  }

  return mockArticles[articleId] ?? null
}

// ============================================================
// GET: 構造化データプレビュー生成
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const articleId = searchParams.get('articleId')
  const includeValidation = searchParams.get('validate') === 'true'

  if (!articleId) {
    return NextResponse.json(
      { error: 'articleId query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const article = await fetchArticle(articleId)

    if (!article) {
      return NextResponse.json(
        { error: `Article not found: ${articleId}` },
        { status: 404 }
      )
    }

    const categorySlug = article.category?.slug ?? 'column'
    const jsonLd = generateStructuredData(article)
    const appliedTypes = CATEGORY_SCHEMA_MAP[categorySlug] ?? ['Article', 'BreadcrumbList']

    const preview: StructuredDataPreview = {
      articleId: article.id,
      articleTitle: article.title,
      jsonLd,
      appliedTypes,
      category: categorySlug,
    }

    const response: {
      preview: StructuredDataPreview
      validation?: ValidationResult
    } = { preview }

    if (includeValidation) {
      response.validation = validateStructuredData(jsonLd, categorySlug)
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[admin/structured-data] GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: 構造化データ検証
// ============================================================

interface ValidateRequest {
  /** 記事ID（記事データから構造化データを自動生成して検証） */
  articleId?: string
  /** 直接検証する JSON-LD データ */
  jsonLd?: Record<string, unknown>
  /** カテゴリ（検証ルールの選択に使用） */
  category?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  let body: ValidateRequest
  try {
    body = (await request.json()) as ValidateRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.articleId && !body.jsonLd) {
    return NextResponse.json(
      { error: 'Either articleId or jsonLd is required' },
      { status: 400 }
    )
  }

  try {
    let jsonLd: Record<string, unknown>
    let category: string

    if (body.jsonLd) {
      // 直接渡された JSON-LD を検証
      jsonLd = body.jsonLd
      category = body.category ?? 'column'
    } else {
      // 記事IDから構造化データを生成して検証
      const article = await fetchArticle(body.articleId!)

      if (!article) {
        return NextResponse.json(
          { error: `Article not found: ${body.articleId}` },
          { status: 404 }
        )
      }

      jsonLd = generateStructuredData(article)
      category = article.category?.slug ?? 'column'
    }

    const validation = validateStructuredData(jsonLd, category)

    return NextResponse.json({
      validation,
      jsonLd,
      category,
    })
  } catch (err) {
    console.error('[admin/structured-data] POST error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// 構造化データ生成
// ============================================================

/**
 * MicroCMS記事から構造化データ (JSON-LD) を生成する
 */
function generateStructuredData(
  article: MicroCMSArticle
): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://menscataly.com'
  const slug = article.slug ?? article.id
  const articleUrl = `${baseUrl}/articles/${slug}`
  const categorySlug = article.category?.slug ?? ''
  const categoryName = article.category?.name ?? ''
  const imageUrl = article.thumbnail_url ?? article.thumbnail?.url ?? null

  const isMedical = ['aga', 'ed', 'hair-removal'].includes(categorySlug)

  // @graph 配列を構築
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph: Record<string, any>[] = []

  // 1. Article or MedicalWebPage
  const articleSchema: Record<string, unknown> = {
    '@type': isMedical ? 'MedicalWebPage' : 'Article',
    '@id': articleUrl,
    headline: article.title,
    description: article.excerpt ?? '',
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    url: articleUrl,
    author: {
      '@type': 'Organization',
      name: article.author_name ?? 'メンズカタリ編集部',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'メンズカタリ',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
  }

  // 画像情報
  if (imageUrl) {
    articleSchema.image = {
      '@type': 'ImageObject',
      url: imageUrl,
      width: article.thumbnail?.width ?? 1200,
      height: article.thumbnail?.height ?? 630,
    }
  }

  // MedicalWebPage 固有のフィールド
  if (isMedical) {
    articleSchema.about = {
      '@type': 'MedicalCondition',
      name: getMedicalConditionName(categorySlug),
    }
    articleSchema.lastReviewed = article.updatedAt

    if (article.supervisor_name) {
      articleSchema.reviewedBy = {
        '@type': 'Person',
        name: article.supervisor_name,
        jobTitle: article.supervisor_creds ?? '医師',
        description: article.supervisor_bio ?? '',
      }
    }

    // 医療免責事項
    articleSchema.specialty = {
      '@type': 'MedicalSpecialty',
      name: getMedicalSpecialtyName(categorySlug),
    }
  }

  // 監修者情報 (E-E-A-T)
  if (article.supervisor_name) {
    articleSchema.editor = {
      '@type': 'Person',
      name: article.supervisor_name,
      jobTitle: article.supervisor_creds ?? '',
    }
  }

  graph.push(articleSchema)

  // 2. BreadcrumbList
  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'ホーム', item: baseUrl },
    { '@type': 'ListItem', position: 2, name: '記事一覧', item: `${baseUrl}/articles` },
  ]

  if (categorySlug) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryName,
      item: `${baseUrl}/articles?category=${categorySlug}`,
    })
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 4,
      name: article.title,
      item: articleUrl,
    })
  } else {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: article.title,
      item: articleUrl,
    })
  }

  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  })

  // 3. FAQ Schema (コンテンツ内のQ&Aを検出)
  const faqItems = extractFAQFromContent(article.content)
  if (faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqItems.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    })
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}

// ============================================================
// 構造化データ検証
// ============================================================

/**
 * 構造化データを検証する
 */
function validateStructuredData(
  jsonLd: Record<string, unknown>,
  category: string
): ValidationResult {
  const errors: ValidationError[] = []
  const checkedTypes: StructuredDataType[] = []
  const recommendedTypes = CATEGORY_SCHEMA_MAP[category] ?? ['Article', 'BreadcrumbList']

  // @context チェック
  if (jsonLd['@context'] !== 'https://schema.org') {
    errors.push({
      level: 'error',
      schemaType: 'Article',
      field: '@context',
      message: '@context が "https://schema.org" ではありません',
      suggestion: '"@context": "https://schema.org" を設定してください',
    })
  }

  // @graph チェック
  const graph = jsonLd['@graph']
  if (!Array.isArray(graph)) {
    errors.push({
      level: 'error',
      schemaType: 'Article',
      field: '@graph',
      message: '@graph が配列ではありません',
      suggestion: '構造化データを @graph 配列形式にしてください',
    })
    return { valid: false, score: 0, errors, checkedTypes, recommendedTypes }
  }

  // 各 @graph エントリを検証
  for (const entry of graph) {
    const type = entry['@type'] as StructuredDataType | undefined
    if (!type) continue

    checkedTypes.push(type)
    const requiredFields = REQUIRED_FIELDS[type]

    if (requiredFields) {
      for (const field of requiredFields) {
        if (!entry[field]) {
          errors.push({
            level: 'error',
            schemaType: type,
            field,
            message: `${type} の必須フィールド "${field}" が欠落しています`,
            suggestion: `"${field}" フィールドを追加してください`,
          })
        }
      }
    }

    // Article / MedicalWebPage 固有の検証
    if (type === 'Article' || type === 'MedicalWebPage') {
      validateArticleSchema(entry, type, errors, category)
    }

    // FAQPage 固有の検証
    if (type === 'FAQPage') {
      validateFAQSchema(entry, errors)
    }

    // BreadcrumbList 固有の検証
    if (type === 'BreadcrumbList') {
      validateBreadcrumbSchema(entry, errors)
    }
  }

  // 推奨スキーマタイプの欠落チェック
  for (const recommended of recommendedTypes) {
    if (!checkedTypes.includes(recommended)) {
      errors.push({
        level: 'warning',
        schemaType: recommended,
        field: '@type',
        message: `推奨されるスキーマタイプ "${recommended}" が含まれていません`,
        suggestion: `${category} カテゴリの記事では ${recommended} スキーマの追加を推奨します`,
      })
    }
  }

  // スコア計算
  const errorCount = errors.filter((e) => e.level === 'error').length
  const warningCount = errors.filter((e) => e.level === 'warning').length
  const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5)
  const valid = errorCount === 0

  return { valid, score, errors, checkedTypes, recommendedTypes }
}

/**
 * Article / MedicalWebPage 固有の検証
 */
function validateArticleSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entry: any,
  type: StructuredDataType,
  errors: ValidationError[],
  category: string
): void {
  // headline の長さチェック
  if (entry.headline && typeof entry.headline === 'string') {
    if (entry.headline.length > 110) {
      errors.push({
        level: 'warning',
        schemaType: type,
        field: 'headline',
        message: 'headline が110文字を超えています（Google推奨上限）',
        suggestion: '110文字以内に短縮してください',
      })
    }
  }

  // 日付フォーマットチェック
  for (const dateField of ['datePublished', 'dateModified']) {
    if (entry[dateField] && typeof entry[dateField] === 'string') {
      if (!isValidISO8601(entry[dateField])) {
        errors.push({
          level: 'error',
          schemaType: type,
          field: dateField,
          message: `${dateField} が有効なISO 8601形式ではありません`,
          suggestion: 'ISO 8601 形式（例: 2026-01-15T09:00:00Z）で指定してください',
        })
      }
    }
  }

  // author チェック
  if (entry.author) {
    if (!entry.author.name) {
      errors.push({
        level: 'error',
        schemaType: type,
        field: 'author.name',
        message: 'author.name が欠落しています',
        suggestion: '著者名を指定してください',
      })
    }
  }

  // MedicalWebPage 固有: 医療カテゴリで reviewedBy がない
  const isMedicalCategory = ['aga', 'ed', 'hair-removal'].includes(category)
  if (type === 'MedicalWebPage' || isMedicalCategory) {
    if (!entry.reviewedBy) {
      errors.push({
        level: isMedicalCategory ? 'error' : 'warning',
        schemaType: type,
        field: 'reviewedBy',
        message: '医療コンテンツに reviewedBy（監修者）が設定されていません',
        suggestion: 'YMYL/E-E-A-T 対応のため、監修医師情報を追加してください',
      })
    }
  }

  // image チェック
  if (!entry.image) {
    errors.push({
      level: 'warning',
      schemaType: type,
      field: 'image',
      message: 'image が設定されていません',
      suggestion: 'リッチリザルト表示のため、OGP画像を設定してください',
    })
  }
}

/**
 * FAQPage 固有の検証
 */
function validateFAQSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entry: any,
  errors: ValidationError[]
): void {
  if (!entry.mainEntity || !Array.isArray(entry.mainEntity)) {
    errors.push({
      level: 'error',
      schemaType: 'FAQPage',
      field: 'mainEntity',
      message: 'FAQPage の mainEntity が配列ではありません',
      suggestion: 'Question オブジェクトの配列を設定してください',
    })
    return
  }

  for (let i = 0; i < entry.mainEntity.length; i++) {
    const question = entry.mainEntity[i]
    if (!question.name) {
      errors.push({
        level: 'error',
        schemaType: 'FAQPage',
        field: `mainEntity[${i}].name`,
        message: `FAQ #${i + 1} の質問テキスト（name）が欠落しています`,
      })
    }
    if (!question.acceptedAnswer?.text) {
      errors.push({
        level: 'error',
        schemaType: 'FAQPage',
        field: `mainEntity[${i}].acceptedAnswer.text`,
        message: `FAQ #${i + 1} の回答テキスト（acceptedAnswer.text）が欠落しています`,
      })
    }
  }
}

/**
 * BreadcrumbList 固有の検証
 */
function validateBreadcrumbSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entry: any,
  errors: ValidationError[]
): void {
  if (!entry.itemListElement || !Array.isArray(entry.itemListElement)) {
    errors.push({
      level: 'error',
      schemaType: 'BreadcrumbList',
      field: 'itemListElement',
      message: 'BreadcrumbList の itemListElement が配列ではありません',
      suggestion: 'ListItem オブジェクトの配列を設定してください',
    })
    return
  }

  for (let i = 0; i < entry.itemListElement.length; i++) {
    const item = entry.itemListElement[i]
    if (!item.position) {
      errors.push({
        level: 'error',
        schemaType: 'BreadcrumbList',
        field: `itemListElement[${i}].position`,
        message: `パンくず #${i + 1} の position が欠落しています`,
      })
    }
    if (!item.name) {
      errors.push({
        level: 'error',
        schemaType: 'BreadcrumbList',
        field: `itemListElement[${i}].name`,
        message: `パンくず #${i + 1} の name が欠落しています`,
      })
    }
  }
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 記事コンテンツからFAQを抽出する
 */
function extractFAQFromContent(
  content: string
): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = []

  // H3/H4 タグで "Q." または "?" を含むものをFAQとして抽出
  const questionPattern = /<h[34][^>]*>(.*?(?:Q\.|？|\?).*?)<\/h[34]>/gi
  const matches = [...content.matchAll(questionPattern)]

  for (const match of matches) {
    const question = match[1].replace(/<[^>]*>/g, '').trim()
    // 質問の次のテキストブロックを回答として取得
    const afterQuestion = content.slice(
      (match.index ?? 0) + match[0].length
    )
    const answerMatch = afterQuestion.match(
      /<p[^>]*>([\s\S]*?)<\/p>/
    )
    if (answerMatch) {
      const answer = answerMatch[1].replace(/<[^>]*>/g, '').trim()
      if (question && answer) {
        faqs.push({ question, answer })
      }
    }
  }

  return faqs
}

/**
 * ISO 8601 形式の日付かどうかを検証する
 */
function isValidISO8601(dateString: string): boolean {
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/
  if (!iso8601Pattern.test(dateString)) return false

  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * カテゴリから医療条件名を取得する
 */
function getMedicalConditionName(category: string): string {
  const conditionMap: Record<string, string> = {
    aga: '男性型脱毛症（AGA）',
    ed: '勃起不全（ED）',
    'hair-removal': '医療脱毛',
  }
  return conditionMap[category] ?? ''
}

/**
 * カテゴリから医療専門分野名を取得する
 */
function getMedicalSpecialtyName(category: string): string {
  const specialtyMap: Record<string, string> = {
    aga: '皮膚科',
    ed: '泌尿器科',
    'hair-removal': '美容皮膚科',
  }
  return specialtyMap[category] ?? ''
}

/**
 * 記事データを取得する (microCMS / フォールバック)
 */
async function fetchArticle(articleId: string): Promise<MicroCMSArticle | null> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain || !apiKey) {
    return getMockArticle(articleId)
  }

  try {
    const { getArticleBySlug } = await import('@/lib/microcms/client')
    return await getArticleBySlug(articleId)
  } catch {
    return getMockArticle(articleId)
  }
}
