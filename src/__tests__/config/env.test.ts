/**
 * 環境変数バリデーション Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateEnv, requireEnv, getEnv } from '@/lib/config/env'

describe('環境変数バリデーション', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // ==============================================================
  // validateEnv
  // ==============================================================
  describe('validateEnv', () => {
    it('開発環境で全環境変数未設定の場合、warnings のみが返ること', () => {
      process.env.NODE_ENV = 'development'
      // 必須変数をクリア
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.ADMIN_API_KEY

      const result = validateEnv()

      // 開発環境では requiredInDev: false の変数は warnings に入る
      expect(result.missing).toHaveLength(0)
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThanOrEqual(0)
    })

    it('本番環境で必須変数が不足している場合、missing に含まれること', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.ADMIN_API_KEY
      delete process.env.PIPELINE_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      const result = validateEnv()

      expect(result.valid).toBe(false)
      expect(result.missing.length).toBeGreaterThan(0)

      const missingNames = result.missing.map((m) => m.name)
      expect(missingNames).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(missingNames).toContain('ADMIN_API_KEY')
      expect(missingNames).toContain('PIPELINE_API_KEY')
      expect(missingNames).toContain('ANTHROPIC_API_KEY')
    })

    it('全必須変数が設定されている場合、valid が true であること', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
      process.env.MICROCMS_SERVICE_DOMAIN = 'example'
      process.env.MICROCMS_API_KEY = 'microcms-key'
      process.env.ADMIN_API_KEY = 'admin-key'
      process.env.PIPELINE_API_KEY = 'pipeline-key'
      process.env.ANTHROPIC_API_KEY = 'anthropic-key'

      const result = validateEnv()

      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('空文字列の環境変数は未設定として扱うこと', () => {
      process.env.NODE_ENV = 'production'
      process.env.ADMIN_API_KEY = ''
      process.env.PIPELINE_API_KEY = '   '

      const result = validateEnv()

      const missingNames = result.missing.map((m) => m.name)
      expect(missingNames).toContain('ADMIN_API_KEY')
      expect(missingNames).toContain('PIPELINE_API_KEY')
    })
  })

  // ==============================================================
  // requireEnv
  // ==============================================================
  describe('requireEnv', () => {
    it('設定されている環境変数を返すこと', () => {
      process.env.TEST_VAR = 'test-value'
      expect(requireEnv('TEST_VAR')).toBe('test-value')
    })

    it('未設定の場合に例外を投げること', () => {
      delete process.env.UNDEFINED_VAR
      expect(() => requireEnv('UNDEFINED_VAR')).toThrow('Required environment variable UNDEFINED_VAR is not set')
    })

    it('空文字列の場合に例外を投げること', () => {
      process.env.EMPTY_VAR = ''
      expect(() => requireEnv('EMPTY_VAR')).toThrow('Required environment variable EMPTY_VAR is not set')
    })
  })

  // ==============================================================
  // getEnv
  // ==============================================================
  describe('getEnv', () => {
    it('設定されている場合、環境変数値を返すこと', () => {
      process.env.TEST_VAR = 'actual-value'
      expect(getEnv('TEST_VAR', 'default-value')).toBe('actual-value')
    })

    it('未設定の場合、デフォルト値を返すこと', () => {
      delete process.env.UNDEFINED_VAR
      expect(getEnv('UNDEFINED_VAR', 'default-value')).toBe('default-value')
    })

    it('空文字列の場合、デフォルト値を返すこと', () => {
      process.env.EMPTY_VAR = ''
      expect(getEnv('EMPTY_VAR', 'default-value')).toBe('default-value')
    })
  })
})
