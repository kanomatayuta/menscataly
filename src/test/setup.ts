import '@testing-library/jest-dom';

// 環境変数モック
process.env.MICROCMS_SERVICE_DOMAIN = 'test-service';
process.env.MICROCMS_API_KEY = 'test-api-key-xxxxxxxxxxxxx';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// グローバルモック: Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// グローバルモック: next/image (JSX不使用のスタブ実装)
vi.mock('next/image', () => ({
  default: vi.fn().mockImplementation(({ src, alt }: { src: string; alt: string }) => {
    // テスト環境では軽量なスタブを返す
    return { type: 'img', props: { src, alt } };
  }),
}));

// afterEach クリーンアップ
afterEach(() => {
  vi.clearAllMocks();
});
