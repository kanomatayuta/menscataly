/**
 * microCMS Webhook Route Unit Tests
 * Webhook署名検証 / ペイロード処理のテスト
 * valid / invalid / missing signature テスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// モック定義
// ============================================================

// Next.js cache 関連モック
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// Supabase モック
const mockUpsertArticle = vi.fn().mockResolvedValue(undefined)
const mockDeleteArticle = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({})),
  upsertArticle: (...args: unknown[]) => mockUpsertArticle(...args),
  deleteArticle: (...args: unknown[]) => mockDeleteArticle(...args),
}))

import { POST, GET } from '@/app/api/webhook/microcms/route'
import { NextRequest } from 'next/server'

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * HMAC-SHA256 署名を生成する
 */
async function generateSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(body)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
}

const TEST_WEBHOOK_SECRET = 'test-webhook-secret-for-tests'

function createWebhookRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  const bodyStr = JSON.stringify(body)
  return new NextRequest('http://localhost:3000/api/webhook/microcms', {
    method: 'POST',
    body: bodyStr,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

/**
 * 署名付きWebhookリクエストを生成する
 */
async function createSignedWebhookRequest(
  body: Record<string, unknown>,
  secret: string = TEST_WEBHOOK_SECRET,
  extraHeaders: Record<string, string> = {}
): Promise<NextRequest> {
  const bodyStr = JSON.stringify(body)
  const signature = await generateSignature(secret, bodyStr)
  return new NextRequest('http://localhost:3000/api/webhook/microcms', {
    method: 'POST',
    body: bodyStr,
    headers: {
      'Content-Type': 'application/json',
      'X-MICROCMS-Signature': signature,
      ...extraHeaders,
    },
  })
}

const newArticlePayload = {
  service: 'menscataly',
  api: 'articles',
  id: 'art-001',
  type: 'new' as const,
  contents: {
    new: {
      id: 'art-001',
      status: ['published'],
      draftKey: null,
      publishValue: {
        title: 'テスト記事',
        slug: 'test-article',
        content: '<p>テストコンテンツ</p>',
        category: { id: 'cat-001', name: 'AGA', slug: 'aga' },
      },
      draftValue: null,
    },
  },
}

const editArticlePayload = {
  ...newArticlePayload,
  type: 'edit' as const,
}

const deleteArticlePayload = {
  service: 'menscataly',
  api: 'articles',
  id: 'art-001',
  type: 'delete' as const,
}

// ============================================================
// テスト
// ============================================================

describe('Webhook /api/webhook/microcms', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // ============================================================
  // GET メソッド
  // ============================================================

  describe('GET', () => {
    it('405 Method Not Allowed を返すこと', async () => {
      const response = GET()

      expect(response.status).toBe(405)
      const data = await response.json()
      expect(data.error).toBe('Method Not Allowed')
    })
  })

  // ============================================================
  // 署名検証
  // ============================================================

  describe('POST — 署名検証', () => {
    it('MICROCMS_WEBHOOK_SECRET未設定時に503を返すこと', async () => {
      delete process.env.MICROCMS_WEBHOOK_SECRET

      const req = createWebhookRequest(newArticlePayload)
      const response = await POST(req)

      expect(response.status).toBe(503)
      const data = await response.json()
      expect(data.error).toBe('Webhook not configured')
    })

    it('有効な署名でリクエストが処理されること', async () => {
      const secret = 'test-webhook-secret-123'
      process.env.MICROCMS_WEBHOOK_SECRET = secret

      const bodyStr = JSON.stringify(newArticlePayload)
      const signature = await generateSignature(secret, bodyStr)

      const req = new NextRequest('http://localhost:3000/api/webhook/microcms', {
        method: 'POST',
        body: bodyStr,
        headers: {
          'Content-Type': 'application/json',
          'X-MICROCMS-Signature': signature,
        },
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('created')
    })

    it('無効な署名で401を返すこと', async () => {
      process.env.MICROCMS_WEBHOOK_SECRET = 'correct-secret'

      const req = createWebhookRequest(newArticlePayload, {
        'X-MICROCMS-Signature': 'invalid-signature-value',
      })

      const response = await POST(req)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('署名ヘッダーが欠如している場合に401を返すこと', async () => {
      process.env.MICROCMS_WEBHOOK_SECRET = 'test-secret'

      const req = createWebhookRequest(newArticlePayload)

      const response = await POST(req)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('小文字ヘッダー x-microcms-signature でも署名検証が成功すること', async () => {
      const secret = 'test-secret-lower'
      process.env.MICROCMS_WEBHOOK_SECRET = secret

      const bodyStr = JSON.stringify(newArticlePayload)
      const signature = await generateSignature(secret, bodyStr)

      const req = new NextRequest('http://localhost:3000/api/webhook/microcms', {
        method: 'POST',
        body: bodyStr,
        headers: {
          'Content-Type': 'application/json',
          'x-microcms-signature': signature,
        },
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })

  // ============================================================
  // 記事作成 (new)
  // ============================================================

  describe('POST — 新規記事', () => {
    beforeEach(() => {
      process.env.MICROCMS_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET
    })

    it('新規記事をSupabaseにupsertすること', async () => {
      const req = await createSignedWebhookRequest(newArticlePayload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('created')
      expect(data.id).toBe('art-001')
      expect(data.slug).toBe('test-article')

      expect(mockUpsertArticle).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          microcms_id: 'art-001',
          slug: 'test-article',
          title: 'テスト記事',
          category: 'aga',
          status: 'published',
        })
      )
    })

    it('revalidateされるパスとタグが正しいこと', async () => {
      const req = await createSignedWebhookRequest(newArticlePayload)
      const response = await POST(req)

      const data = await response.json()
      expect(data.revalidated.paths).toContain('/articles')
      expect(data.revalidated.paths).toContain('/articles/test-article')
      expect(data.revalidated.tags).toContain('articles')
    })
  })

  // ============================================================
  // 記事更新 (edit)
  // ============================================================

  describe('POST — 記事更新', () => {
    beforeEach(() => {
      process.env.MICROCMS_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET
    })

    it('更新記事をSupabaseにupsertすること', async () => {
      const req = await createSignedWebhookRequest(editArticlePayload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('updated')

      expect(mockUpsertArticle).toHaveBeenCalled()
    })

    it('publishValueがnullの場合にスキップすること', async () => {
      const draftOnlyPayload = {
        ...editArticlePayload,
        contents: {
          new: {
            id: 'art-001',
            status: ['draft'],
            draftKey: 'draft-key',
            publishValue: null,
            draftValue: { title: '下書き記事' },
          },
        },
      }

      const req = await createSignedWebhookRequest(draftOnlyPayload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('Skipped')
      expect(mockUpsertArticle).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 記事削除 (delete)
  // ============================================================

  describe('POST — 記事削除', () => {
    beforeEach(() => {
      process.env.MICROCMS_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET
    })

    it('記事をSupabaseから削除すること', async () => {
      const req = await createSignedWebhookRequest(deleteArticlePayload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('deleted')

      expect(mockDeleteArticle).toHaveBeenCalledWith(
        expect.anything(),
        'art-001'
      )
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('POST — エッジケース', () => {
    beforeEach(() => {
      process.env.MICROCMS_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET
    })

    it('articles以外のAPIはスキップすること', async () => {
      const nonArticlePayload = {
        service: 'menscataly',
        api: 'categories',
        id: 'cat-001',
        type: 'new' as const,
      }

      const req = await createSignedWebhookRequest(nonArticlePayload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('Skipped')
      expect(mockUpsertArticle).not.toHaveBeenCalled()
    })

    it('不正なJSONで400を返すこと', async () => {
      // 不正なJSONの場合、署名はボディに対して生成
      const badBody = 'not-json-body{{{'
      const signature = await generateSignature(TEST_WEBHOOK_SECRET, badBody)

      const req = new NextRequest('http://localhost:3000/api/webhook/microcms', {
        method: 'POST',
        body: badBody,
        headers: {
          'Content-Type': 'application/json',
          'X-MICROCMS-Signature': signature,
        },
      })

      const response = await POST(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid JSON')
    })
  })
})
