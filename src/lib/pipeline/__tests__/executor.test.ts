/**
 * PipelineExecutor Unit Tests
 * 実行フロー、リトライ、タイムアウト、アラート、Supabaseロギングをテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineExecutor } from '../executor'
import type { PipelineStep } from '../types'
import { createMockPipelineStep } from '@/test/helpers'

// ============================================================
// モック: AlertManager
// ============================================================

const mockCreateAlert = vi.fn().mockResolvedValue({})

vi.mock('@/lib/monitoring/alert-manager', () => ({
  AlertManager: vi.fn().mockImplementation(() => ({
    createAlert: mockCreateAlert,
  })),
}))

// ============================================================
// モック: Supabase client
// ============================================================

const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert })

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn().mockReturnValue({
    from: mockFrom,
  }),
}))

// ============================================================
// テスト本体
// ============================================================

describe('PipelineExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // 正常実行テスト
  // ----------------------------------------------------------

  describe('正常実行', () => {
    it('全ステップが正常完了した場合、statusはsuccessになること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step1 = createMockPipelineStep({
        name: 'step-1',
        execute: vi.fn().mockResolvedValue({ data: 'step1-output' }),
      })

      const step2 = createMockPipelineStep({
        name: 'step-2',
        execute: vi.fn().mockResolvedValue({ data: 'step2-output' }),
      })

      const result = await executor.run([step1, step2], { initial: true })

      expect(result.status).toBe('success')
      expect(result.stepLogs).toHaveLength(2)
      expect(result.stepLogs[0].status).toBe('success')
      expect(result.stepLogs[1].status).toBe('success')
      expect(result.metadata.totalSteps).toBe(2)
      expect(result.metadata.completedSteps).toBe(2)
      expect(result.metadata.failedSteps).toBe(0)
    })

    it('runIdがUUID形式で生成されること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step = createMockPipelineStep({
        execute: vi.fn().mockResolvedValue('ok'),
      })

      const result = await executor.run([step])

      // UUID v4 format
      expect(result.runId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('durationMsが正の値になること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step = createMockPipelineStep({
        execute: vi.fn().mockResolvedValue('done'),
      })

      const result = await executor.run([step])

      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  // ----------------------------------------------------------
  // コンテキスト受け渡しテスト
  // ----------------------------------------------------------

  describe('コンテキストの受け渡し', () => {
    it('前のステップの出力が次のステップの入力になること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step1Output = { trends: ['aga', 'hair-removal'] }
      const step1 = createMockPipelineStep({
        name: 'fetch-trends',
        execute: vi.fn().mockResolvedValue(step1Output),
      })

      const step2Execute = vi.fn().mockResolvedValue({ processed: true })
      const step2 = createMockPipelineStep({
        name: 'process-data',
        execute: step2Execute,
      })

      await executor.run([step1, step2], { initialData: true })

      // step2 は step1 の出力を入力として受け取る
      expect(step2Execute).toHaveBeenCalledWith(
        step1Output,
        expect.objectContaining({
          runId: expect.any(String),
          type: expect.any(String),
        })
      )
    })

    it('initialInputが最初のステップに渡されること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const stepExecute = vi.fn().mockResolvedValue('output')
      const step = createMockPipelineStep({ execute: stepExecute })

      const initialInput = { keyword: 'AGA治療' }
      await executor.run([step], initialInput)

      expect(stepExecute).toHaveBeenCalledWith(
        initialInput,
        expect.objectContaining({
          runId: expect.any(String),
        })
      )
    })
  })

  // ----------------------------------------------------------
  // リトライテスト
  // ----------------------------------------------------------

  describe('リトライロジック', () => {
    it('ステップが1回失敗してリトライで成功した場合、パイプラインは成功すること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const stepExecute = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success')

      const step = createMockPipelineStep({
        name: 'flaky-step',
        execute: stepExecute,
        maxRetries: 3,
      })

      const result = await executor.run([step])

      expect(result.status).toBe('success')
      expect(stepExecute).toHaveBeenCalledTimes(2)
      expect(result.stepLogs[0].metadata.attempts).toBe(2)
    })

    it('maxRetries回失敗した場合、パイプラインはfailedになること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const stepExecute = vi
        .fn()
        .mockRejectedValue(new Error('Persistent failure'))

      const step = createMockPipelineStep({
        name: 'always-failing-step',
        execute: stepExecute,
        maxRetries: 2,
      })

      const result = await executor.run([step])

      expect(result.status).toBe('failed')
      expect(result.error).toBe('Persistent failure')
      // maxRetries=2 means initial + 2 retries = 3 attempts
      expect(stepExecute).toHaveBeenCalledTimes(3)
      expect(result.stepLogs[0].status).toBe('failed')
      expect(result.stepLogs[0].metadata.attempts).toBe(3)
    })

    it('デフォルトのmaxRetriesは3であること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const stepExecute = vi
        .fn()
        .mockRejectedValue(new Error('Always fail'))

      // maxRetries を指定しない
      const step: PipelineStep = {
        name: 'no-maxretries-step',
        description: 'Test step without maxRetries',
        execute: stepExecute,
      }

      const result = await executor.run([step])

      expect(result.status).toBe('failed')
      // default maxRetries=3: initial + 3 retries = 4 attempts
      expect(stepExecute).toHaveBeenCalledTimes(4)
    })
  })

  // ----------------------------------------------------------
  // タイムアウトテスト
  // ----------------------------------------------------------

  describe('タイムアウト処理', () => {
    it('ステップがタイムアウトした場合、エラーメッセージにtimed outが含まれること', async () => {
      const executor = new PipelineExecutor({
        timeoutMs: 100,
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const stepExecute = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          // タイムアウトより長い時間待つ
          setTimeout(() => resolve('late'), 5000)
        })
      })

      const step = createMockPipelineStep({
        name: 'slow-step',
        execute: stepExecute,
        maxRetries: 0,
      })

      const result = await executor.run([step])

      expect(result.status).toBe('failed')
      expect(result.error).toContain('timed out')
    })
  })

  // ----------------------------------------------------------
  // アラート生成テスト
  // ----------------------------------------------------------

  describe('アラート生成', () => {
    it('ステップが失敗した場合、createFailureAlertが呼ばれること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      // private メソッドをスパイする
      const alertSpy = vi.spyOn(
        executor as unknown as { createFailureAlert: (stepName: string, error: string | null, runId: string) => Promise<void> },
        'createFailureAlert'
      )

      const stepExecute = vi
        .fn()
        .mockRejectedValue(new Error('Critical error'))

      const step = createMockPipelineStep({
        name: 'failing-step',
        execute: stepExecute,
        maxRetries: 0,
      })

      await executor.run([step])

      expect(alertSpy).toHaveBeenCalledWith(
        'failing-step',
        'Critical error',
        expect.any(String)
      )
    })

    it('全ステップが成功した場合、アラートは作成されないこと', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step = createMockPipelineStep({
        execute: vi.fn().mockResolvedValue('ok'),
      })

      await executor.run([step])

      expect(mockCreateAlert).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------
  // Supabaseロギングテスト
  // ----------------------------------------------------------

  describe('Supabaseへの記録', () => {
    it('enableSupabaseLogging=trueでdryRun=falseの場合、Supabaseに記録されること', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: true,
        dryRun: false,
        retryDelayMs: 0,
      })

      const step = createMockPipelineStep({
        execute: vi.fn().mockResolvedValue('ok'),
      })

      const result = await executor.run([step])

      expect(mockFrom).toHaveBeenCalledWith('pipeline_runs')
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.runId,
          status: 'success',
        })
      )
    })

    it('enableSupabaseLogging=falseの場合、Supabaseに記録されないこと', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step = createMockPipelineStep({
        execute: vi.fn().mockResolvedValue('ok'),
      })

      await executor.run([step])

      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('dryRun=trueの場合、Supabaseに記録されないこと', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: true,
        dryRun: true,
        retryDelayMs: 0,
      })

      const step = createMockPipelineStep({
        execute: vi.fn().mockResolvedValue('ok'),
      })

      const result = await executor.run([step])

      expect(result.metadata.dryRun).toBe(true)
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------
  // パイプライン失敗時の中断テスト
  // ----------------------------------------------------------

  describe('失敗時の中断', () => {
    it('ステップが失敗した場合、後続ステップは実行されないこと', async () => {
      const executor = new PipelineExecutor({
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step1Execute = vi
        .fn()
        .mockRejectedValue(new Error('Step 1 failed'))

      const step2Execute = vi.fn().mockResolvedValue('step2-output')

      const step1 = createMockPipelineStep({
        name: 'step-1',
        execute: step1Execute,
        maxRetries: 0,
      })

      const step2 = createMockPipelineStep({
        name: 'step-2',
        execute: step2Execute,
      })

      const result = await executor.run([step1, step2])

      expect(result.status).toBe('failed')
      expect(result.stepLogs).toHaveLength(1)
      expect(step2Execute).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------
  // PipelineConfig テスト
  // ----------------------------------------------------------

  describe('設定', () => {
    it('configタイプがPipelineResultに反映されること', async () => {
      const executor = new PipelineExecutor({
        type: 'daily',
        enableSupabaseLogging: false,
        retryDelayMs: 0,
      })

      const step = createMockPipelineStep({
        execute: vi.fn().mockResolvedValue('ok'),
      })

      const result = await executor.run([step])

      expect(result.type).toBe('daily')
    })
  })
})
