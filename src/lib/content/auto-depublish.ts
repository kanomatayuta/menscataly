/**
 * 自動非公開システム
 * 薬機法違反フラグ検出時にmicroCMS記事を自動で非公開化する
 * PDCA夜間バッチ (23:00 JST) から呼び出される
 */

import { ComplianceChecker } from '@/lib/compliance/checker'
import { AlertManager } from '@/lib/monitoring/alert-manager'
import type { ComplianceResult } from '@/lib/compliance/types'

// ============================================================
// 型定義
// ============================================================

/** 非公開対象記事の情報 */
export interface DepublishCandidate {
  /** microCMS コンテンツID */
  contentId: string
  /** 記事タイトル */
  title: string
  /** 記事スラッグ */
  slug: string
  /** コンプライアンスチェック結果 */
  complianceResult: ComplianceResult
  /** 非公開理由 */
  reason: string
  /** クリティカル違反があるかどうか */
  hasCriticalViolation: boolean
}

/** 非公開処理結果 */
export interface DepublishResult {
  /** スキャンした記事総数 */
  totalScanned: number
  /** 非公開対象として検出された記事数 */
  flaggedCount: number
  /** 非公開処理が成功した記事数 */
  depublishedCount: number
  /** 非公開処理に失敗した記事数 */
  failedCount: number
  /** 非公開対象の詳細 */
  candidates: DepublishCandidate[]
  /** アラートID（生成されたアラートのID） */
  alertIds: string[]
  /** 処理時間 (ms) */
  processingTimeMs: number
  /** 実行日時 (ISO 8601) */
  executedAt: string
}

/** 自動非公開の設定 */
export interface AutoDepublishConfig {
  /** コンプライアンススコア閾値（これ以下で非公開対象、デフォルト: 70） */
  scoreThreshold: number
  /** ドライラン（実際の非公開処理をスキップ、デフォルト: false） */
  dryRun: boolean
  /** 1回のバッチで処理する最大記事数 */
  maxArticlesPerBatch: number
  /** Supabase レビューキューに追加するか */
  addToReviewQueue: boolean
}

/** microCMS記事の簡易型（APIレスポンスから必要な情報のみ） */
interface MicroCMSArticleMinimal {
  id: string
  title: string
  slug: string
  content: string
  status?: string
}

// ============================================================
// デフォルト設定
// ============================================================

const DEFAULT_CONFIG: AutoDepublishConfig = {
  scoreThreshold: 70,
  dryRun: false,
  maxArticlesPerBatch: 100,
  addToReviewQueue: true,
}

// ============================================================
// microCMS API ヘルパー
// ============================================================

/**
 * microCMS から公開済み記事を一括取得する
 */
async function fetchPublishedArticles(
  limit: number
): Promise<MicroCMSArticleMinimal[]> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain || !apiKey) {
    console.info('[AutoDepublish] microCMS not configured — returning empty list')
    return []
  }

  try {
    const url = `https://${serviceDomain}.microcms.io/api/v1/articles?limit=${limit}&fields=id,title,slug,content,status&filters=status[equals]published`
    const response = await fetch(url, {
      headers: { 'X-MICROCMS-API-KEY': apiKey },
    })

    if (!response.ok) {
      throw new Error(`microCMS API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      contents: MicroCMSArticleMinimal[]
      totalCount: number
    }
    return data.contents ?? []
  } catch (err) {
    console.error('[AutoDepublish] Failed to fetch articles from microCMS:', err)
    return []
  }
}

/**
 * microCMS の記事を下書き状態に変更する（非公開化）
 */
async function depublishArticle(contentId: string): Promise<boolean> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain || !apiKey) {
    console.info(`[AutoDepublish] DRY RUN — Would depublish article: ${contentId}`)
    return true
  }

  try {
    const url = `https://${serviceDomain}.microcms.io/api/v1/articles/${contentId}`
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-MICROCMS-API-KEY': apiKey,
      },
      body: JSON.stringify({ status: 'draft' }),
    })

    if (!response.ok) {
      throw new Error(`microCMS PATCH error: ${response.status} ${response.statusText}`)
    }

    return true
  } catch (err) {
    console.error(`[AutoDepublish] Failed to depublish article ${contentId}:`, err)
    return false
  }
}

// ============================================================
// Supabase レビューキューヘルパー
// ============================================================

/**
 * Supabase のレビューキューに非公開対象を追加する
 */
async function addToReviewQueue(candidate: DepublishCandidate): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.info(`[AutoDepublish] Supabase not configured — skipping review queue for: ${candidate.contentId}`)
    return
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('article_reviews')
      .insert({
        article_id: candidate.contentId,
        title: candidate.title,
        slug: candidate.slug,
        status: 'pending',
        compliance_score: candidate.complianceResult.score,
        review_notes: candidate.reason,
        has_critical_violation: candidate.hasCriticalViolation,
        auto_depublished: true,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error(`[AutoDepublish] Failed to add to review queue:`, error.message)
    }
  } catch (err) {
    console.error('[AutoDepublish] Supabase error:', err)
  }
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 全公開記事をスキャンし、コンプライアンス違反のある記事を自動非公開化する
 *
 * PDCA夜間バッチ (23:00 JST) から呼び出される想定。
 * 1. microCMS から全公開記事を取得
 * 2. ComplianceChecker で各記事をチェック
 * 3. スコア < 閾値 OR クリティカル違反 → 非公開対象としてマーク
 * 4. AlertManager にアラートを作成
 * 5. Supabase レビューキューに追加
 * 6. 非公開処理を実行しログに記録
 *
 * @param config 自動非公開の設定
 * @returns 処理結果
 *
 * @example
 * ```ts
 * const result = await scanAndDepublish({ dryRun: true })
 * console.log(`スキャン: ${result.totalScanned}, 非公開: ${result.depublishedCount}`)
 * ```
 */
export async function scanAndDepublish(
  config: Partial<AutoDepublishConfig> = {}
): Promise<DepublishResult> {
  const effectiveConfig: AutoDepublishConfig = { ...DEFAULT_CONFIG, ...config }
  const startTime = Date.now()
  const now = new Date().toISOString()

  console.info('[AutoDepublish] Starting compliance scan...')
  console.info(`[AutoDepublish] Config: scoreThreshold=${effectiveConfig.scoreThreshold}, dryRun=${effectiveConfig.dryRun}`)

  // 1. 公開記事を取得
  const articles = await fetchPublishedArticles(effectiveConfig.maxArticlesPerBatch)
  console.info(`[AutoDepublish] Fetched ${articles.length} published articles`)

  if (articles.length === 0) {
    return {
      totalScanned: 0,
      flaggedCount: 0,
      depublishedCount: 0,
      failedCount: 0,
      candidates: [],
      alertIds: [],
      processingTimeMs: Date.now() - startTime,
      executedAt: now,
    }
  }

  // 2. コンプライアンスチェック
  const checker = new ComplianceChecker({ autoFix: false, strictMode: true })
  const candidates: DepublishCandidate[] = []

  for (const article of articles) {
    const complianceResult = checker.check(article.content, {
      categories: ['aga', 'hair_removal', 'skincare', 'ed', 'common'],
    })

    // クリティカル違反の判定（high severity の違反がある場合）
    const hasCriticalViolation = complianceResult.violations.some(
      (v) => v.severity === 'high'
    )

    // 非公開対象の判定
    const shouldDepublish =
      complianceResult.score < effectiveConfig.scoreThreshold || hasCriticalViolation

    if (shouldDepublish) {
      // 非公開理由の構築
      const reasons: string[] = []
      if (complianceResult.score < effectiveConfig.scoreThreshold) {
        reasons.push(`コンプライアンススコア ${complianceResult.score} (閾値: ${effectiveConfig.scoreThreshold})`)
      }
      if (hasCriticalViolation) {
        const criticalViolations = complianceResult.violations.filter((v) => v.severity === 'high')
        reasons.push(`クリティカル違反 ${criticalViolations.length}件: ${criticalViolations.map((v) => v.ngText).join(', ')}`)
      }
      if (!complianceResult.hasPRDisclosure) {
        reasons.push('PR表記が欠如しています')
      }

      candidates.push({
        contentId: article.id,
        title: article.title,
        slug: article.slug,
        complianceResult,
        reason: reasons.join(' / '),
        hasCriticalViolation,
      })
    }
  }

  console.info(`[AutoDepublish] Flagged ${candidates.length}/${articles.length} articles for depublish`)

  // 3. アラート作成
  const alertManager = new AlertManager()
  const alertIds: string[] = []

  for (const candidate of candidates) {
    try {
      const alert = await alertManager.createAlert({
        type: 'compliance_violation',
        severity: candidate.hasCriticalViolation ? 'critical' : 'warning',
        title: `コンプライアンス違反検出: ${candidate.title}`,
        message: candidate.reason,
        metadata: {
          contentId: candidate.contentId,
          slug: candidate.slug,
          complianceScore: candidate.complianceResult.score,
          violationCount: candidate.complianceResult.violations.length,
          hasCriticalViolation: candidate.hasCriticalViolation,
        },
      })
      alertIds.push(alert.id)
    } catch (err) {
      console.error(`[AutoDepublish] Failed to create alert for ${candidate.contentId}:`, err)
    }
  }

  // 4. レビューキューに追加 & 非公開処理
  let depublishedCount = 0
  let failedCount = 0

  for (const candidate of candidates) {
    // レビューキューに追加
    if (effectiveConfig.addToReviewQueue) {
      await addToReviewQueue(candidate)
    }

    // 非公開処理
    if (effectiveConfig.dryRun) {
      console.info(`[AutoDepublish] DRY RUN — Would depublish: "${candidate.title}" (${candidate.contentId})`)
      console.info(`[AutoDepublish]   Reason: ${candidate.reason}`)
      depublishedCount++
    } else {
      const success = await depublishArticle(candidate.contentId)
      if (success) {
        depublishedCount++
        console.info(`[AutoDepublish] Depublished: "${candidate.title}" (${candidate.contentId})`)
        logDepublishAction(candidate, now)
      } else {
        failedCount++
        console.error(`[AutoDepublish] Failed to depublish: "${candidate.title}" (${candidate.contentId})`)
      }
    }
  }

  const result: DepublishResult = {
    totalScanned: articles.length,
    flaggedCount: candidates.length,
    depublishedCount,
    failedCount,
    candidates,
    alertIds,
    processingTimeMs: Date.now() - startTime,
    executedAt: now,
  }

  console.info(`[AutoDepublish] Completed. Scanned: ${result.totalScanned}, Flagged: ${result.flaggedCount}, Depublished: ${result.depublishedCount}, Failed: ${result.failedCount}`)
  console.info(`[AutoDepublish] Processing time: ${result.processingTimeMs}ms`)

  return result
}

// ============================================================
// ログヘルパー
// ============================================================

/**
 * 非公開アクションをSupabaseに記録する
 */
async function logDepublishAction(
  candidate: DepublishCandidate,
  executedAt: string
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.info(`[AutoDepublish] Logged depublish action (in-memory): ${candidate.contentId} — ${candidate.reason}`)
    return
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('depublish_logs')
      .insert({
        content_id: candidate.contentId,
        title: candidate.title,
        slug: candidate.slug,
        reason: candidate.reason,
        compliance_score: candidate.complianceResult.score,
        violation_count: candidate.complianceResult.violations.length,
        has_critical_violation: candidate.hasCriticalViolation,
        executed_at: executedAt,
      })

    if (error) {
      console.error('[AutoDepublish] Failed to log depublish action:', error.message)
    }
  } catch (err) {
    console.error('[AutoDepublish] Supabase log error:', err)
  }
}

/**
 * 単一記事のコンプライアンスチェックを実行し、非公開が必要かどうかを判定する
 * ユーティリティ関数として記事公開前のバリデーションにも使用可能
 */
export function checkShouldDepublish(
  content: string,
  scoreThreshold: number = DEFAULT_CONFIG.scoreThreshold
): { shouldDepublish: boolean; result: ComplianceResult; reason: string } {
  const checker = new ComplianceChecker({ autoFix: false, strictMode: true })
  const result = checker.check(content, {
    categories: ['aga', 'hair_removal', 'skincare', 'ed', 'common'],
  })

  const hasCriticalViolation = result.violations.some((v) => v.severity === 'high')
  const shouldDepublish = result.score < scoreThreshold || hasCriticalViolation

  const reasons: string[] = []
  if (result.score < scoreThreshold) {
    reasons.push(`スコア ${result.score} < 閾値 ${scoreThreshold}`)
  }
  if (hasCriticalViolation) {
    reasons.push('クリティカル違反あり')
  }

  return {
    shouldDepublish,
    result,
    reason: shouldDepublish ? reasons.join(' / ') : '問題なし',
  }
}
