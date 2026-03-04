/**
 * POST /api/batch/generate
 * バッチ記事生成ジョブの作成
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { BatchArticleGenerator } from '@/lib/batch/generator'
import type { BatchGenerationRequest, KeywordTarget } from '@/types/batch-generation'
import type { ContentCategory, ContentTone } from '@/types/content'

// ============================================================
// バリデーション
// ============================================================

const VALID_CATEGORIES: ContentCategory[] = ['aga', 'hair-removal', 'skincare', 'ed']
const VALID_TONES: ContentTone[] = ['informative', 'friendly', 'professional', 'comparison']

function validateKeyword(kw: unknown, index: number): string | null {
  if (!kw || typeof kw !== 'object') {
    return `keywords[${index}] must be an object`
  }

  const k = kw as Record<string, unknown>

  if (!k.keyword || typeof k.keyword !== 'string') {
    return `keywords[${index}].keyword is required and must be a string`
  }
  if (!k.category || !VALID_CATEGORIES.includes(k.category as ContentCategory)) {
    return `keywords[${index}].category must be one of: ${VALID_CATEGORIES.join(', ')}`
  }
  if (k.tone && !VALID_TONES.includes(k.tone as ContentTone)) {
    return `keywords[${index}].tone must be one of: ${VALID_TONES.join(', ')}`
  }

  return null
}

function validateRequest(body: unknown): { valid: true; request: BatchGenerationRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  const b = body as Record<string, unknown>

  if (!Array.isArray(b.keywords) || b.keywords.length === 0) {
    return { valid: false, error: 'keywords must be a non-empty array' }
  }

  if (b.keywords.length > 30) {
    return { valid: false, error: 'Maximum 30 keywords per batch' }
  }

  // Validate each keyword
  for (let i = 0; i < b.keywords.length; i++) {
    const err = validateKeyword(b.keywords[i], i)
    if (err) return { valid: false, error: err }
  }

  const keywords: KeywordTarget[] = b.keywords.map((kw: Record<string, unknown>, i: number) => ({
    id: (kw.id as string) ?? `kw-${i}`,
    keyword: kw.keyword as string,
    subKeywords: Array.isArray(kw.subKeywords) ? kw.subKeywords as string[] : [],
    category: kw.category as ContentCategory,
    priority: (kw.priority as 'high' | 'medium' | 'low') ?? 'medium',
    searchVolume: (kw.searchVolume as number) ?? 0,
    difficulty: (kw.difficulty as number) ?? 50,
    targetAudience: (kw.targetAudience as string) ?? '20〜40代男性',
    tone: (kw.tone as ContentTone) ?? 'informative',
    targetLength: (kw.targetLength as number) ?? 3000,
    outlineHints: Array.isArray(kw.outlineHints) ? kw.outlineHints as string[] : undefined,
  }))

  const request: BatchGenerationRequest = {
    keywords,
    maxConcurrent: Math.min(Math.max((b.maxConcurrent as number) ?? 2, 1), 5),
    complianceThreshold: (b.complianceThreshold as number) ?? 90,
    dryRun: (b.dryRun as boolean) ?? false,
    continueOnError: (b.continueOnError as boolean) ?? true,
    requestedBy: (b.requestedBy as string) ?? 'api',
  }

  return { valid: true, request }
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 認証チェック
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  // リクエストボディのパース
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // バリデーション
  const validation = validateRequest(body)
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    )
  }

  try {
    const generator = new BatchArticleGenerator()
    const progress = await generator.generateBatch(validation.request)

    return NextResponse.json(
      {
        success: true,
        jobId: progress.jobId,
        status: progress.status,
        totalKeywords: progress.total,
        message: `Batch generation started for ${progress.total} keywords`,
      },
      { status: 202 }
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[batch/generate] Failed to start batch:', errorMessage)

    return NextResponse.json(
      { error: 'Failed to start batch generation', details: errorMessage },
      { status: 500 }
    )
  }
}
