/**
 * テストヘルパー: モックファクトリ
 * microCMS / Supabase のテスト用スタブを生成する
 */

// =============================================================================
// microCMS モックファクトリ
// =============================================================================

export interface MockMicroCMSArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  isPR: boolean;
  publishedAt: string;
  updatedAt: string;
  revisedAt: string;
  createdAt: string;
}

export interface MockMicroCMSListResponse<T> {
  contents: T[];
  totalCount: number;
  offset: number;
  limit: number;
}

/**
 * microCMS 記事モックを生成する
 */
export function createMockArticle(
  overrides: Partial<MockMicroCMSArticle> = {}
): MockMicroCMSArticle {
  return {
    id: 'mock-article-001',
    title: 'AGA治療の基礎知識',
    content: '<p>記事本文のサンプルテキストです。</p>',
    category: 'aga',
    isPR: false,
    publishedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    revisedAt: '2026-01-15T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * microCMS リストレスポンスモックを生成する
 */
export function createMockListResponse<T>(
  contents: T[],
  overrides: Partial<Omit<MockMicroCMSListResponse<T>, 'contents'>> = {}
): MockMicroCMSListResponse<T> {
  return {
    contents,
    totalCount: contents.length,
    offset: 0,
    limit: 10,
    ...overrides,
  };
}

// =============================================================================
// Supabase モックファクトリ
// =============================================================================

export interface MockSupabaseArticleStats {
  article_id: string;
  pv_count: number;
  cv_count: number;
  revenue: number;
  created_at: string;
}

/**
 * Supabase 記事統計モックを生成する
 */
export function createMockArticleStats(
  overrides: Partial<MockSupabaseArticleStats> = {}
): MockSupabaseArticleStats {
  return {
    article_id: 'mock-article-001',
    pv_count: 1000,
    cv_count: 10,
    revenue: 5000,
    created_at: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Supabase クエリビルダーのモックを生成する
 * vitest の vi.fn() を使ってチェーン可能なモックを返す
 */
export function createMockSupabaseQuery<T>(data: T[], error: null | Error = null) {
  const response = { data, error, count: data.length };

  const query = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn().mockImplementation((resolve: (value: typeof response) => void) => {
      return Promise.resolve(response).then(resolve);
    }),
  };

  return query;
}
