/**
 * パイプラインスケジューラー
 * Cloud Scheduler / Cloud Run 向けの cron 設定を定義する
 * Next.js の Vercel Cron Jobs にも対応
 */

import type { PipelineConfig, PipelineType } from './types'

// ============================================================
// cron 式定義
// ============================================================

/**
 * スケジュール定義
 * - Cloud Scheduler (Google Cloud) の cron 式
 * - Vercel Cron Jobs の cron 式
 * - いずれも UTC 表記（JST = UTC+9）
 */
export const PIPELINE_SCHEDULES = {
  /**
   * 日次パイプライン
   * 毎日 06:00 JST (= 21:00 UTC 前日) に起動
   * データ取得 → 記事生成 → 公開
   */
  daily: {
    cron: '0 21 * * *',  // UTC: 21:00 = JST 06:00
    timezone: 'Asia/Tokyo',
    description: '日次コンテンツ生成・公開パイプライン (06:00 JST)',
    type: 'daily' as PipelineType,
  },

  /**
   * PDCA夜間バッチ
   * 毎日 23:00 JST (= 14:00 UTC) に起動
   * アナリティクス収集 → パフォーマンス分析 → レポート生成
   */
  pdca: {
    cron: '0 14 * * *',  // UTC: 14:00 = JST 23:00
    timezone: 'Asia/Tokyo',
    description: 'PDCA夜間バッチ (23:00 JST) — アナリティクス収集・分析',
    type: 'pdca' as PipelineType,
  },
} as const

// ============================================================
// Vercel Cron Jobs 設定 (next.config.ts に記述する内容)
// ============================================================

/**
 * Vercel Cron Jobs の設定例
 * next.config.ts の experimental.cron に設定する
 *
 * @example
 * // next.config.ts
 * import { VERCEL_CRON_CONFIG } from '@/lib/pipeline/scheduler'
 * export default { ...VERCEL_CRON_CONFIG }
 */
export const VERCEL_CRON_CONFIG = {
  // Vercel Cron は vercel.json で設定する
  // 参考: https://vercel.com/docs/cron-jobs
  vercelJson: {
    crons: [
      {
        path: '/api/pipeline/run',
        schedule: '0 21 * * *',  // UTC: 日次パイプライン
      },
      {
        path: '/api/pipeline/run',
        schedule: '0 14 * * *',  // UTC: PDCA夜間バッチ
      },
    ],
  },
}

// ============================================================
// Cloud Scheduler 設定 (Cloud Run 向け)
// ============================================================

export interface CloudSchedulerJob {
  name: string
  schedule: string
  timeZone: string
  httpTarget: {
    uri: string
    httpMethod: 'POST' | 'GET'
    headers: Record<string, string>
    body?: string
  }
  description: string
}

/**
 * Google Cloud Scheduler ジョブ設定を生成する
 * @param baseUrl Cloud Run のベースURL (e.g. https://menscataly-xxxx.a.run.app)
 * @param apiKey パイプラインAPIキー
 */
export function getCloudSchedulerJobs(
  baseUrl: string,
  apiKey: string
): CloudSchedulerJob[] {
  return [
    {
      name: 'menscataly-daily-pipeline',
      schedule: PIPELINE_SCHEDULES.daily.cron,
      timeZone: PIPELINE_SCHEDULES.daily.timezone,
      description: PIPELINE_SCHEDULES.daily.description,
      httpTarget: {
        uri: `${baseUrl}/api/pipeline/run`,
        httpMethod: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pipeline-Api-Key': apiKey,
        },
        body: JSON.stringify({ type: 'daily' }),
      },
    },
    {
      name: 'menscataly-pdca-batch',
      schedule: PIPELINE_SCHEDULES.pdca.cron,
      timeZone: PIPELINE_SCHEDULES.pdca.timezone,
      description: PIPELINE_SCHEDULES.pdca.description,
      httpTarget: {
        uri: `${baseUrl}/api/pipeline/run`,
        httpMethod: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pipeline-Api-Key': apiKey,
        },
        body: JSON.stringify({ type: 'pdca' }),
      },
    },
  ]
}

// ============================================================
// パイプライン設定ファクトリ
// ============================================================

/**
 * パイプライン種別に応じた設定を生成する
 */
export function getPipelineConfig(type: PipelineType): PipelineConfig {
  const baseConfig: PipelineConfig = {
    type,
    maxConcurrentSteps: 1,
    retryDelayMs: 5000,
    timeoutMs: 1800000,     // 30分
    enableSupabaseLogging: true,
    dryRun: process.env.NODE_ENV === 'test',
  }

  switch (type) {
    case 'daily':
      return {
        ...baseConfig,
        retryDelayMs: 10000,  // 日次は10秒待機でリトライ
        timeoutMs: 3600000,   // 60分
      }

    case 'pdca':
      return {
        ...baseConfig,
        retryDelayMs: 5000,
        timeoutMs: 1800000,   // 30分
      }

    case 'manual':
    default:
      return {
        ...baseConfig,
        retryDelayMs: 3000,
        timeoutMs: 900000,    // 15分
      }
  }
}
