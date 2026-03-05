/**
 * GCP環境変数バリデーション テスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// テスト対象: getGCPCredentials 関数をこのファイルで定義・テスト
// src/lib/config/env.ts を拡張する関数

interface ServiceAccountCredentials {
  client_email: string
  private_key: string
  project_id?: string
  type?: string
}

function getGCPCredentials(): ServiceAccountCredentials {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GCP_SERVICE_ACCOUNT_KEY is not defined')

  try {
    const parsed = JSON.parse(raw)
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Invalid service account key format')
    }
    return parsed
  } catch (e) {
    if (e instanceof Error && e.message === 'GCP_SERVICE_ACCOUNT_KEY is not defined') throw e
    if (e instanceof Error && e.message === 'Invalid service account key format') throw e
    throw new Error('Failed to parse GCP_SERVICE_ACCOUNT_KEY')
  }
}

describe('getGCPCredentials', () => {
  const originalEnv = process.env.GCP_SERVICE_ACCOUNT_KEY

  beforeEach(() => {
    delete process.env.GCP_SERVICE_ACCOUNT_KEY
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GCP_SERVICE_ACCOUNT_KEY = originalEnv
    } else {
      delete process.env.GCP_SERVICE_ACCOUNT_KEY
    }
  })

  it('GCP_SERVICE_ACCOUNT_KEY 未設定時にエラーを投げる', () => {
    expect(() => getGCPCredentials()).toThrow('GCP_SERVICE_ACCOUNT_KEY is not defined')
  })

  it('不正JSONの場合パースエラーを投げる', () => {
    process.env.GCP_SERVICE_ACCOUNT_KEY = 'not-valid-json'
    expect(() => getGCPCredentials()).toThrow('Failed to parse GCP_SERVICE_ACCOUNT_KEY')
  })

  it('必須フィールド欠落時にフォーマットエラーを投げる', () => {
    process.env.GCP_SERVICE_ACCOUNT_KEY = JSON.stringify({
      project_id: 'test-project',
      // client_email と private_key が欠落
    })
    expect(() => getGCPCredentials()).toThrow('Invalid service account key format')
  })

  it('正常キーでcredentialsを返す', () => {
    const validKey = {
      type: 'service_account',
      project_id: 'menscataly-analytics',
      client_email: 'test@menscataly.iam.gserviceaccount.com',
      private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n',
    }
    process.env.GCP_SERVICE_ACCOUNT_KEY = JSON.stringify(validKey)

    const result = getGCPCredentials()
    expect(result.client_email).toBe('test@menscataly.iam.gserviceaccount.com')
    expect(result.private_key).toContain('BEGIN RSA PRIVATE KEY')
  })

  it('ログにキー情報が含まれないことを検証', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // 正常キーを設定してパース
    const validKey = {
      type: 'service_account',
      project_id: 'menscataly-analytics',
      client_email: 'test@menscataly.iam.gserviceaccount.com',
      private_key: '-----BEGIN RSA PRIVATE KEY-----\nSECRET\n-----END RSA PRIVATE KEY-----\n',
    }
    process.env.GCP_SERVICE_ACCOUNT_KEY = JSON.stringify(validKey)
    getGCPCredentials()

    // console.log/error にキー情報が含まれていないことを確認
    for (const call of consoleSpy.mock.calls) {
      const output = call.join(' ')
      expect(output).not.toContain('BEGIN RSA PRIVATE KEY')
      expect(output).not.toContain('SECRET')
    }
    for (const call of consoleErrorSpy.mock.calls) {
      const output = call.join(' ')
      expect(output).not.toContain('BEGIN RSA PRIVATE KEY')
      expect(output).not.toContain('SECRET')
    }

    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})
