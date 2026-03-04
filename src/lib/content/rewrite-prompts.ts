/**
 * 記事リライト指示テンプレート
 *
 * 既存記事の改善指示をClaude Sonnet 4.6 API向けに自動生成する。
 * SEO改善、コンプライアンス修正、情報更新、内部リンク追加、E-E-A-T強化の
 * 5つのリライト理由に対応したプロンプトテンプレートを提供。
 *
 * 薬機法第66条・67条 / 景表法 / ステマ規制 準拠
 */

import type { Article, ContentCategory } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** リライト理由 */
export type RewriteReason =
  | 'seo_improvement'       // SEO改善
  | 'compliance_fix'        // コンプライアンス修正
  | 'content_update'        // 情報更新
  | 'internal_linking'      // 内部リンク追加
  | 'eeat_enhancement'      // E-E-A-T強化

/** リライトプロンプト生成オプション */
export interface RewritePromptOptions {
  /** ターゲットキーワード（SEO改善時に追加すべきキーワード） */
  targetKeywords?: string[]
  /** コンプライアンス違反箇所（コンプライアンス修正時） */
  complianceViolations?: Array<{
    ngText: string
    suggestedText: string
    reason: string
  }>
  /** 更新すべき情報（情報更新時） */
  updatePoints?: string[]
  /** 追加すべき内部リンク候補（内部リンク追加時） */
  internalLinks?: Array<{
    title: string
    url: string
    anchorText: string
  }>
  /** E-E-A-T強化ポイント（E-E-A-T強化時） */
  eeatPoints?: string[]
}

/** リライトプロンプト生成結果 */
export interface RewritePromptResult {
  /** リライト理由 */
  reason: RewriteReason
  /** システムプロンプト（Claude API system パラメータ用） */
  systemPrompt: string
  /** ユーザーメッセージ（Claude API messages[0].content 用） */
  userMessage: string
  /** 改善ポイントのサマリー */
  improvementSummary: string[]
  /** 推定トークン数（目安） */
  estimatedTokens: number
}

// ============================================================
// リライト理由の日本語ラベル
// ============================================================

const REWRITE_REASON_LABELS: Record<RewriteReason, string> = {
  seo_improvement: 'SEO改善',
  compliance_fix: 'コンプライアンス修正',
  content_update: '情報更新',
  internal_linking: '内部リンク追加',
  eeat_enhancement: 'E-E-A-T強化',
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 記事リライト指示プロンプトを生成する
 *
 * 対象記事とリライト理由に基づいて、Claude Sonnet 4.6 API 向けの
 * リライト指示プロンプト（system + user）を生成する。
 *
 * @param article 対象記事
 * @param reason リライト理由
 * @param options リライトオプション（ターゲットKW、違反箇所等）
 * @returns リライトプロンプト生成結果
 *
 * @example
 * ```ts
 * const prompt = generateRewritePrompt(article, 'seo_improvement', {
 *   targetKeywords: ['AGA 費用', 'AGA オンライン'],
 * });
 * // Claude API に渡す
 * const response = await client.generate({
 *   systemPrompt: prompt.systemPrompt,
 *   userMessage: prompt.userMessage,
 * });
 * ```
 */
export function generateRewritePrompt(
  article: Article,
  reason: RewriteReason,
  options: RewritePromptOptions = {}
): RewritePromptResult {
  // 記事分析
  const analysis = analyzeArticle(article)

  // リライト理由に応じたプロンプト生成
  switch (reason) {
    case 'seo_improvement':
      return buildSEOImprovementPrompt(article, analysis, options)
    case 'compliance_fix':
      return buildComplianceFixPrompt(article, analysis, options)
    case 'content_update':
      return buildContentUpdatePrompt(article, analysis, options)
    case 'internal_linking':
      return buildInternalLinkingPrompt(article, analysis, options)
    case 'eeat_enhancement':
      return buildEEATEnhancementPrompt(article, analysis, options)
  }
}

// ============================================================
// 記事分析
// ============================================================

interface ArticleAnalysis {
  charCount: number
  sectionCount: number
  referenceCount: number
  hasSupervisor: boolean
  hasPRDisclosure: boolean
  tagCount: number
  daysSincePublished: number
  daysSinceUpdated: number
  categoryLabel: string
}

function analyzeArticle(article: Article): ArticleAnalysis {
  const now = new Date()
  const publishedDate = new Date(article.publishedAt)
  const updatedDate = new Date(article.updatedAt)

  return {
    charCount: article.content.length,
    sectionCount: article.sections.length,
    referenceCount: article.references.length,
    hasSupervisor: !!article.supervisor,
    hasPRDisclosure: article.hasPRDisclosure,
    tagCount: article.tags?.length ?? 0,
    daysSincePublished: Math.floor(
      (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)
    ),
    daysSinceUpdated: Math.floor(
      (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)
    ),
    categoryLabel: getCategoryLabel(article.category),
  }
}

function getCategoryLabel(category: ContentCategory): string {
  const labels: Record<ContentCategory, string> = {
    aga: 'AGA治療',
    ed: 'ED治療',
    'hair-removal': '脱毛',
    skincare: 'スキンケア',
    column: 'コラム',
  }
  return labels[category] ?? category
}

// ============================================================
// 共通プロンプトパーツ
// ============================================================

function getBaseSystemPrompt(): string {
  return [
    'あなたは MENS CATALY（メンズカタリ）の専門医療ライターです。',
    '以下のルールを厳守して記事をリライトしてください。',
    '',
    '## 必須ルール',
    '1. 薬機法第66条・67条を遵守する。効果・安全性の断定表現は使用しない。',
    '2. 景表法を遵守する。最大級表現（No.1、最安等）には客観的根拠と調査日時を明記する。',
    '3. ステマ規制を遵守する。PR表記を記事冒頭に配置する。',
    '4. 「効果には個人差があります」「医師にご相談ください」等の注意書きを適切に配置する。',
    '5. 医薬品の副作用を完全否定しない。「副作用のリスクが低いとされている」等の表現を使用する。',
    '',
    '## NG表現の例',
    '- NG: 「確実に髪が生える」 → OK: 「発毛を促進する効果が期待できる」',
    '- NG: 「副作用なし」 → OK: 「副作用のリスクが低いとされている（個人差があります）」',
    '- NG: 「最安値」 → OK: 「調査時点（YYYY年MM月）での価格」+調査条件明記',
    '- NG: 「シミが完全に消える」 → OK: 「メラニンの生成を抑制する効果がある」',
    '',
    '## 出力形式',
    '修正後の記事をJSONフォーマットで出力してください。',
    '```json',
    '{',
    '  "title": "修正後タイトル",',
    '  "lead": "修正後リード文",',
    '  "sections": [',
    '    { "heading": "...", "level": "h2", "content": "..." }',
    '  ],',
    '  "tags": ["..."],',
    '  "changes": ["変更点1", "変更点2"]',
    '}',
    '```',
  ].join('\n')
}

function buildArticleSummary(article: Article, analysis: ArticleAnalysis): string {
  return [
    '## 対象記事の情報',
    `- タイトル: ${article.title}`,
    `- カテゴリ: ${analysis.categoryLabel}`,
    `- 文字数: ${analysis.charCount}文字`,
    `- セクション数: ${analysis.sectionCount}`,
    `- 参考文献数: ${analysis.referenceCount}`,
    `- 監修者: ${analysis.hasSupervisor ? article.supervisor?.name ?? '設定済み' : '未設定'}`,
    `- PR表記: ${analysis.hasPRDisclosure ? 'あり' : 'なし'}`,
    `- 公開日: ${article.publishedAt}（${analysis.daysSincePublished}日前）`,
    `- 最終更新日: ${article.updatedAt}（${analysis.daysSinceUpdated}日前）`,
    `- コンプライアンススコア: ${article.complianceScore ?? '未チェック'}`,
  ].join('\n')
}

// ============================================================
// SEO改善プロンプト
// ============================================================

function buildSEOImprovementPrompt(
  article: Article,
  analysis: ArticleAnalysis,
  options: RewritePromptOptions
): RewritePromptResult {
  const targetKeywords = options.targetKeywords ?? []
  const improvementSummary: string[] = []

  if (targetKeywords.length > 0) {
    improvementSummary.push(`ターゲットキーワード「${targetKeywords.join('」「')}」を自然に記事内に含める`)
  }
  if (analysis.charCount < 3000) {
    improvementSummary.push(`文字数が${analysis.charCount}文字と少ないため、3,000文字以上に拡充する`)
  }
  if (analysis.sectionCount < 5) {
    improvementSummary.push(`セクション数が${analysis.sectionCount}と少ないため、5〜8セクションに拡充する`)
  }
  improvementSummary.push('メタディスクリプションを120文字以内で最適化する')
  improvementSummary.push('H2/H3見出しにキーワードを自然に含める')

  const systemPrompt = [
    getBaseSystemPrompt(),
    '',
    '## リライト目的: SEO改善',
    'この記事のSEOパフォーマンスを改善するためにリライトしてください。',
    '以下のSEO最適化ポイントを意識してください:',
    '- ターゲットキーワードを見出し・本文に自然に含める',
    '- メタディスクリプションを検索意図に合わせて最適化する（120文字以内）',
    '- 見出し構造（H2→H3）を論理的に整理する',
    '- FAQセクションの追加を検討する（People Also Ask対策）',
    '- 読者の検索意図に沿った情報を追加する',
  ].join('\n')

  const userMessage = [
    buildArticleSummary(article, analysis),
    '',
    '## SEO改善指示',
    targetKeywords.length > 0
      ? `以下のターゲットキーワードを記事内に自然に含めてください:\n${targetKeywords.map((k) => `- ${k}`).join('\n')}`
      : '記事全体のSEO最適化を行ってください。',
    '',
    '## 改善ポイント',
    improvementSummary.map((p) => `- ${p}`).join('\n'),
    '',
    '## 現在の記事内容',
    '```',
    article.content,
    '```',
  ].join('\n')

  return {
    reason: 'seo_improvement',
    systemPrompt,
    userMessage,
    improvementSummary,
    estimatedTokens: estimateTokenCount(systemPrompt + userMessage),
  }
}

// ============================================================
// コンプライアンス修正プロンプト
// ============================================================

function buildComplianceFixPrompt(
  article: Article,
  analysis: ArticleAnalysis,
  options: RewritePromptOptions
): RewritePromptResult {
  const violations = options.complianceViolations ?? []
  const improvementSummary: string[] = []

  if (violations.length > 0) {
    improvementSummary.push(`${violations.length}件のコンプライアンス違反を修正する`)
    for (const v of violations) {
      improvementSummary.push(`「${v.ngText}」→「${v.suggestedText}」（${v.reason}）`)
    }
  }
  if (!analysis.hasPRDisclosure) {
    improvementSummary.push('PR表記（アフィリエイト広告表記）を記事冒頭に追加する')
  }

  const systemPrompt = [
    getBaseSystemPrompt(),
    '',
    '## リライト目的: コンプライアンス修正',
    '薬機法第66条・67条、景表法、ステマ規制に違反している表現を修正してください。',
    '以下の点に特に注意してください:',
    '- NG表現を全てOK表現に置換する',
    '- 「個人差があります」等の注意書きを適切に追加する',
    '- PR表記が欠如している場合は記事冒頭に追加する',
    '- 修正後も文章の自然さ・読みやすさを維持する',
  ].join('\n')

  const violationList =
    violations.length > 0
      ? violations
          .map(
            (v, i) =>
              `${i + 1}. NG: 「${v.ngText}」\n   OK: 「${v.suggestedText}」\n   理由: ${v.reason}`
          )
          .join('\n')
      : '（具体的な違反箇所の指定なし。記事全体をチェックしてください）'

  const userMessage = [
    buildArticleSummary(article, analysis),
    '',
    '## コンプライアンス違反箇所',
    violationList,
    '',
    '## 修正指示',
    '上記の違反箇所を全て修正し、薬機法・景表法・ステマ規制に完全準拠した記事に修正してください。',
    '',
    '## 現在の記事内容',
    '```',
    article.content,
    '```',
  ].join('\n')

  return {
    reason: 'compliance_fix',
    systemPrompt,
    userMessage,
    improvementSummary,
    estimatedTokens: estimateTokenCount(systemPrompt + userMessage),
  }
}

// ============================================================
// 情報更新プロンプト
// ============================================================

function buildContentUpdatePrompt(
  article: Article,
  analysis: ArticleAnalysis,
  options: RewritePromptOptions
): RewritePromptResult {
  const updatePoints = options.updatePoints ?? []
  const improvementSummary: string[] = []

  if (analysis.daysSinceUpdated > 180) {
    improvementSummary.push(`最終更新から${analysis.daysSinceUpdated}日が経過。情報の鮮度を確認・更新する`)
  }
  if (updatePoints.length > 0) {
    for (const point of updatePoints) {
      improvementSummary.push(point)
    }
  }
  improvementSummary.push('価格情報・費用相場を最新に更新する')
  improvementSummary.push('情報鮮度注記の日付を更新する')

  const systemPrompt = [
    getBaseSystemPrompt(),
    '',
    '## リライト目的: 情報更新',
    '記事内の情報を最新の状態に更新してください。',
    '以下の点に注意してください:',
    '- 価格・費用の情報を最新に更新する（調査日時を明記）',
    '- ガイドライン・基準の変更があれば反映する',
    '- 「YYYY年MM月時点」等の日付情報を更新する',
    '- 廃止・終了したサービスの情報を削除・更新する',
    '- 新しい治療法・製品の情報があれば追記する',
  ].join('\n')

  const updateList =
    updatePoints.length > 0
      ? updatePoints.map((p) => `- ${p}`).join('\n')
      : '（具体的な更新ポイントの指定なし。記事全体の情報鮮度を確認してください）'

  const userMessage = [
    buildArticleSummary(article, analysis),
    '',
    '## 更新ポイント',
    updateList,
    '',
    '## 更新指示',
    `この記事は${analysis.daysSinceUpdated}日前に最終更新されました。記事内の情報を最新の状態に更新してください。`,
    '',
    '## 現在の記事内容',
    '```',
    article.content,
    '```',
  ].join('\n')

  return {
    reason: 'content_update',
    systemPrompt,
    userMessage,
    improvementSummary,
    estimatedTokens: estimateTokenCount(systemPrompt + userMessage),
  }
}

// ============================================================
// 内部リンク追加プロンプト
// ============================================================

function buildInternalLinkingPrompt(
  article: Article,
  analysis: ArticleAnalysis,
  options: RewritePromptOptions
): RewritePromptResult {
  const internalLinks = options.internalLinks ?? []
  const improvementSummary: string[] = []

  if (internalLinks.length > 0) {
    improvementSummary.push(`${internalLinks.length}件の内部リンクを記事内に自然に追加する`)
    for (const link of internalLinks) {
      improvementSummary.push(`「${link.anchorText}」→ ${link.url}`)
    }
  }
  improvementSummary.push('リンクの配置位置が文脈的に自然であることを確認する')
  improvementSummary.push('1セクションあたりの内部リンク数を1〜2本に制限する')

  const systemPrompt = [
    getBaseSystemPrompt(),
    '',
    '## リライト目的: 内部リンク追加',
    '記事内に関連記事への内部リンクを自然に追加してください。',
    '以下のルールに従ってください:',
    '- リンクは文脈上自然な箇所に配置する',
    '- 1セクションあたりの内部リンクは1〜2本までにする',
    '- アンカーテキストは自然な日本語で、キーワードを含める',
    '- アフィリエイトリンクとの混在を避ける（内部リンクは rel="sponsored" をつけない）',
    '- リンクのMDフォーマット: [アンカーテキスト](URL)',
  ].join('\n')

  const linkList =
    internalLinks.length > 0
      ? internalLinks
          .map((l) => `- [${l.anchorText}](${l.url}) — ${l.title}`)
          .join('\n')
      : '（内部リンク候補の指定なし。関連トピックへのリンク配置を検討してください）'

  const userMessage = [
    buildArticleSummary(article, analysis),
    '',
    '## 追加する内部リンク候補',
    linkList,
    '',
    '## リンク追加指示',
    '上記の内部リンクを記事内の文脈上自然な箇所に追加してください。',
    '記事の読みやすさを損なわないように注意してください。',
    '',
    '## 現在の記事内容',
    '```',
    article.content,
    '```',
  ].join('\n')

  return {
    reason: 'internal_linking',
    systemPrompt,
    userMessage,
    improvementSummary,
    estimatedTokens: estimateTokenCount(systemPrompt + userMessage),
  }
}

// ============================================================
// E-E-A-T強化プロンプト
// ============================================================

function buildEEATEnhancementPrompt(
  article: Article,
  analysis: ArticleAnalysis,
  options: RewritePromptOptions
): RewritePromptResult {
  const eeatPoints = options.eeatPoints ?? []
  const improvementSummary: string[] = []

  if (!analysis.hasSupervisor) {
    improvementSummary.push('監修者情報を追加する')
  }
  if (analysis.referenceCount < 3) {
    improvementSummary.push(`参考文献数が${analysis.referenceCount}件と少ないため、3件以上に拡充する`)
  }
  if (analysis.daysSinceUpdated > 180) {
    improvementSummary.push('更新日が6ヶ月以上前のため、最新情報に更新する')
  }
  improvementSummary.push('体験・実績データの引用を充実させる')
  improvementSummary.push('免責事項・注意書きを適切に配置する')
  if (eeatPoints.length > 0) {
    for (const point of eeatPoints) {
      improvementSummary.push(point)
    }
  }

  const systemPrompt = [
    getBaseSystemPrompt(),
    '',
    '## リライト目的: E-E-A-T強化',
    'Google の E-E-A-T（Experience, Expertise, Authoritativeness, Trustworthiness）基準に基づいて記事を強化してください。',
    '',
    '### Experience（経験）',
    '- 実際の体験談、症例データ、利用者の声を追加する',
    '- 「実際に」「体験」等の表現で経験に基づく情報であることを示す',
    '',
    '### Expertise（専門性）',
    '- 監修者の資格・経歴情報を充実させる',
    '- 専門用語の適切な使用と平易な解説を両立する',
    '',
    '### Authoritativeness（権威性）',
    '- 学会ガイドライン、PubMed論文、公的機関のデータを参考文献に追加する',
    '- 権威性の高いソース（政府機関、学会）からの引用を増やす',
    '',
    '### Trustworthiness（信頼性）',
    '- 免責事項を適切に配置する',
    '- 情報鮮度の注記（「YYYY年MM月時点」）を追加する',
    '- PR表記を明確にする',
    '- 「個人差があります」等の注意書きを配置する',
  ].join('\n')

  const userMessage = [
    buildArticleSummary(article, analysis),
    '',
    '## E-E-A-T強化ポイント',
    improvementSummary.map((p) => `- ${p}`).join('\n'),
    '',
    '## E-E-A-T強化指示',
    'Experience, Expertise, Authoritativeness, Trustworthiness の4つの観点から記事を改善してください。',
    '特に YMYL（Your Money or Your Life）コンテンツとしての品質基準を満たすことを最優先してください。',
    '',
    '## 現在の記事内容',
    '```',
    article.content,
    '```',
  ].join('\n')

  return {
    reason: 'eeat_enhancement',
    systemPrompt,
    userMessage,
    improvementSummary,
    estimatedTokens: estimateTokenCount(systemPrompt + userMessage),
  }
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * トークン数を概算する（日本語: 1文字 ≒ 1.5トークン、英語: 1単語 ≒ 1.3トークン）
 */
function estimateTokenCount(text: string): number {
  const japaneseChars = (text.match(/[\u3000-\u9FFF\uF900-\uFAFF]/g) ?? []).length
  const otherChars = text.length - japaneseChars
  return Math.ceil(japaneseChars * 1.5 + otherChars * 0.4)
}

/**
 * リライト理由の日本語ラベルを取得する
 */
export function getRewriteReasonLabel(reason: RewriteReason): string {
  return REWRITE_REASON_LABELS[reason]
}

/**
 * 全リライト理由の一覧を取得する
 */
export function getAllRewriteReasons(): RewriteReason[] {
  return Object.keys(REWRITE_REASON_LABELS) as RewriteReason[]
}
