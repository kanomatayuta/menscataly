/**
 * POST /api/test/generate
 * テスト記事生成エンドポイント
 * Claude API → コンプライアンスチェック → microCMS ドラフト投稿
 *
 * 開発環境専用 (NODE_ENV !== 'production')
 */

import { NextRequest, NextResponse } from 'next/server'
import { ArticleGenerator } from '@/lib/content/generator'
import { ArticlePublisher } from '@/lib/content/publisher'
import type { ContentGenerationRequest } from '@/types/content'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 本番環境・プレビュー環境では無効化（ローカル開発環境のみ有効）
  if (
    (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NODE_ENV === 'production'
  ) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  // リクエストボディ (オプション: カスタムキーワード)
  let body: { keyword?: string; category?: string } = {}
  try {
    const text = await request.text()
    if (text) {
      body = JSON.parse(text) as typeof body
    }
  } catch {
    // デフォルト値を使用
  }

  const generationRequest: ContentGenerationRequest = {
    category: (body.category as ContentGenerationRequest['category']) ?? 'aga',
    keyword: body.keyword ?? 'AGA治療 オンラインクリニック 比較',
    subKeywords: ['AGA オンライン診療', 'フィナステリド 処方', 'AGA クリニック 費用'],
    targetAudience: '20〜40代男性、AGAが気になり始めた方',
    tone: 'informative',
    targetLength: 3000,
  }

  console.log('============================================================')
  console.log('[test/generate] テスト記事生成開始')
  console.log(`  キーワード: ${generationRequest.keyword}`)
  console.log(`  カテゴリ: ${generationRequest.category}`)
  console.log('============================================================')

  try {
    // ================================================================
    // Step 1: Claude API で記事生成
    // ================================================================
    console.log('[test/generate] Step 1: Claude API 記事生成...')
    const generator = new ArticleGenerator()
    const result = await generator.generate(generationRequest)

    console.log(`[test/generate] 生成完了:`)
    console.log(`  タイトル: ${result.article.title}`)
    console.log(`  モデル: ${result.model}`)
    console.log(`  処理時間: ${result.processingTimeMs}ms`)
    console.log(`  コンプライアンススコア: ${result.compliance.score}`)
    console.log(`  準拠: ${result.compliance.isCompliant ? 'OK' : 'NG'}`)
    console.log(`  PR表記: ${result.compliance.hasPRDisclosure ? 'あり' : 'なし'}`)
    if (result.compliance.violations.length > 0) {
      console.log(`  違反数: ${result.compliance.violations.length}`)
      result.compliance.violations.forEach((v, i) => {
        console.log(`    ${i + 1}. ${v.ngText} → ${v.suggestedText}`)
      })
    }

    // ================================================================
    // Step 2: microCMS にドラフト投稿
    // ================================================================
    console.log('[test/generate] Step 2: microCMS ドラフト投稿...')
    let publishData: {
      contentId: string
      url: string
      status: string
      isDryRun: boolean
      error?: string
    }

    try {
      const publisher = new ArticlePublisher()
      const publishResult = await publisher.publishToMicroCMS(result.article, {
        status: 'draft',
      })

      console.log(`[test/generate] 投稿完了:`)
      console.log(`  コンテンツID: ${publishResult.contentId}`)
      console.log(`  URL: ${publishResult.url}`)
      console.log(`  ドライラン: ${publishResult.isDryRun}`)

      publishData = {
        contentId: publishResult.contentId,
        url: publishResult.url,
        status: publishResult.status,
        isDryRun: publishResult.isDryRun,
      }
    } catch (publishError) {
      const publishMsg = publishError instanceof Error ? publishError.message : String(publishError)
      console.warn(`[test/generate] microCMS 投稿スキップ: ${publishMsg}`)
      publishData = {
        contentId: '',
        url: '',
        status: 'skipped',
        isDryRun: false,
        error: publishMsg,
      }
    }

    console.log('============================================================')

    return NextResponse.json({
      success: true,
      article: {
        title: result.article.title,
        slug: result.article.slug,
        category: result.article.category,
        lead: result.article.lead,
        readingTime: result.article.readingTime,
        wordCount: result.article.content.length,
        sectionsCount: result.article.sections.length,
        sections: result.article.sections.map(s => ({
          heading: s.heading,
          level: s.level,
          contentLength: s.content.length,
          subsectionsCount: s.subsections?.length ?? 0,
        })),
        referencesCount: result.article.references.length,
        tags: result.article.tags,
        supervisor: result.article.supervisor?.name ?? null,
      },
      compliance: {
        score: result.compliance.score,
        isCompliant: result.compliance.isCompliant,
        hasPRDisclosure: result.compliance.hasPRDisclosure,
        violationsCount: result.compliance.violations.length,
        violations: result.compliance.violations.slice(0, 5),
      },
      generation: {
        model: result.model,
        processingTimeMs: result.processingTimeMs,
        generatedAt: result.generatedAt,
      },
      publish: publishData,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[test/generate] エラー:', message)

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
