# MENS CATALY — テスト戦略 v1.1

**作成日**: 2026年3月2日 | **担当**: QA Agent | **対象バージョン**: v3.0

---

## 1. テスト全体方針

### 1.1 テストピラミッド

```
         ┌───────────────────┐
         │  E2E (Playwright) │  ← ユーザーフロー・コンプライアンス確認
         │     ~20 specs     │
         ├───────────────────┤
         │  Integration      │  ← API・CMS連携・DB
         │     ~30 specs     │
         ├───────────────────┤
         │  Unit (Vitest)    │  ← 薬機法チェッカー・コンポーネント
         │    ~100 specs     │
         └───────────────────┘
```

| レイヤー | ツール | カバレッジ目標 | 優先対象 |
|---------|--------|-------------|---------|
| Unit | Vitest | 80%以上 (コンプライアンスチェッカー: 100%) | 薬機法チェッカー・Utilities |
| Integration | Vitest | 60%以上 | microCMS API・Supabase |
| E2E | Playwright | 主要フロー100% | CV導線・コンプライアンス |

### 1.2 品質ゲート (CI/CD)

| ゲート | 基準 | ブロック対象 |
|-------|------|-----------|
| PR マージ | Unit/Integration 全件パス + カバレッジ基準クリア | 全PR |
| 本番デプロイ | E2E P0シナリオ全件パス + Lighthouse基準クリア | mainブランチ |
| 記事自動公開 (Phase 2+) | 薬機法チェック 0件違反 + 品質スコア≥80 | 全記事 |

---

## 2. 薬機法NG表現検出テストケース

### 2.1 辞書構造

実装済み辞書ファイル: `src/lib/compliance/dictionaries/`

```typescript
interface NgEntry {
  id: string;        // "aga_001" 等
  ng: string;        // NG表現（完全一致）
  ok: string;        // OK変換後の表現
  reason: string;    // 根拠条文
  severity: "high" | "medium" | "low";
}

interface NgDictionary {
  category: "aga" | "ed" | "hair_removal" | "skincare";
  description: string;
  entries: NgEntry[];
}
```

### 2.2 辞書カバレッジ (実装済み)

| カテゴリ | ファイル | エントリ数 | severityHighの割合 |
|---------|---------|----------|-----------------|
| AGA | aga.json | 15件 | 13/15 (87%) |
| ED | ed.json | 10件 | 9/10 (90%) |
| 脱毛 | hair-removal.json | 10件 | 9/10 (90%) |
| スキンケア | skincare.json | 15件 | 12/15 (80%) |
| **合計** | | **50件** | **43/50 (86%)** |

### 2.3 チェッカーのテストケース設計

#### テストグループ 1: 辞書整合性テスト

```typescript
// src/lib/compliance/__tests__/dictionaries.test.ts
describe('NGワード辞書整合性', () => {
  const DICT_FILES = ['aga', 'ed', 'hair-removal', 'skincare'];

  test.each(DICT_FILES)('%s辞書: 全エントリにok変換が存在すること', (category) => {
    const dict: NgDictionary = require(`../dictionaries/${category}.json`);
    dict.entries.forEach(entry => {
      expect(entry.ok).toBeTruthy();
      expect(entry.ok).not.toEqual(entry.ng); // NG ≠ OK
    });
  });

  test.each(DICT_FILES)('%s辞書: IDの重複がないこと', (category) => {
    const dict: NgDictionary = require(`../dictionaries/${category}.json`);
    const ids = dict.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(DICT_FILES)('%s辞書: severityが有効値であること', (category) => {
    const dict: NgDictionary = require(`../dictionaries/${category}.json`);
    const valid = ['high', 'medium', 'low'];
    dict.entries.forEach(entry => {
      expect(valid).toContain(entry.severity);
    });
  });
});
```

#### テストグループ 2: NG表現検出テスト (実辞書データに基づく)

```typescript
// src/lib/compliance/__tests__/checker.test.ts
import { checkCompliance } from '../checker';

describe('薬機法NG表現検出', () => {
  // AGA辞書 (aga.json) の全エントリに対してテスト
  describe('AGA関連', () => {
    test.each([
      // id, ng表現, severity
      ['aga_001', '確実に髪が生える', 'high'],
      ['aga_002', '必ず発毛する', 'high'],
      ['aga_003', '薄毛が完全に治る', 'high'],
      ['aga_004', 'AGAが治る', 'high'],
      ['aga_005', '副作用なし', 'high'],
      ['aga_007', '100%発毛', 'high'],
      ['aga_009', '薄毛を根本から治療', 'high'],
      ['aga_014', '業界最安値のAGA治療', 'high'],
      ['aga_015', 'No.1のAGAクリニック', 'high'],
    ])('%s: "%s" を検出すること (severity: %s)', (id, ngText, severity) => {
      const result = checkCompliance(ngText);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ id, severity })
      );
    });
  });

  // 脱毛辞書 — 特殊ケース: 「永久脱毛」表現
  describe('脱毛関連', () => {
    test('hr_001: 「永久脱毛できる」を検出すること', () => {
      const result = checkCompliance('医療レーザーで永久脱毛できる');
      expect(result.violations).toContainEqual(
        expect.objectContaining({ id: 'hr_001' })
      );
    });

    test('hr_003: 「痛みが全くない」を検出すること', () => {
      const result = checkCompliance('痛みが全くない脱毛サロン');
      expect(result.violations).toContainEqual(
        expect.objectContaining({ id: 'hr_003' })
      );
    });
  });

  // スキンケア辞書
  describe('スキンケア関連', () => {
    test.each([
      ['sc_001', 'シミが完全に消える'],
      ['sc_002', 'シミが消える'],
      ['sc_007', '肌が若返る'],
      ['sc_008', '老化を止める'],
    ])('%s: "%s" を検出すること', (id, ngText) => {
      const result = checkCompliance(ngText);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ id })
      );
    });
  });

  // ED辞書
  describe('ED関連', () => {
    test('ed_002: 「ED完治」を検出すること', () => {
      const result = checkCompliance('ED完治を目指すクリニック');
      expect(result.violations).toContainEqual(
        expect.objectContaining({ id: 'ed_002' })
      );
    });

    test('ed_006: 医薬品名+断定表現を検出すること', () => {
      const result = checkCompliance('シアリスで100%改善');
      expect(result.violations).toContainEqual(
        expect.objectContaining({ id: 'ed_006' })
      );
    });
  });
});
```

#### テストグループ 3: OK変換テスト

```typescript
describe('OK表現への自動変換', () => {
  test('aga_001: NG→OK変換が正しいこと', () => {
    const result = checkCompliance('確実に髪が生えるAGA治療');
    expect(result.corrected).toContain('発毛を促進する効果が期待できる');
    expect(result.corrected).not.toContain('確実に髪が生える');
  });

  test('変換後に再チェックでviolationsがゼロになること', () => {
    const original = '確実に髪が生えます。副作用なしで安全です。';
    const { corrected } = checkCompliance(original);
    const recheck = checkCompliance(corrected!);
    expect(recheck.violations).toHaveLength(0);
  });

  test('複数NG表現が1テキストに含まれる場合、全て変換されること', () => {
    const text = '確実に髪が生えて、副作用なし、業界最安値のAGA治療';
    const { violations, corrected } = checkCompliance(text);
    expect(violations.length).toBeGreaterThanOrEqual(3);
    const recheck = checkCompliance(corrected!);
    expect(recheck.violations).toHaveLength(0);
  });
});
```

#### テストグループ 4: 文脈分析テスト

```typescript
describe('文脈を考慮した検出', () => {
  test('「〜とは言えません」という否定文中は検出しないこと', () => {
    const result = checkCompliance('確実に髪が生えるとは言えません');
    // 否定文脈なので違反なし or severity: 'low'
    const highViolations = result.violations.filter(v => v.severity === 'high');
    expect(highViolations).toHaveLength(0);
  });

  test('「〜という主張は根拠がない」という批判文脈は違反扱いしないこと', () => {
    const result = checkCompliance(
      '「AGAが治る」という主張は科学的根拠がないとされています'
    );
    // 引用符内の批判的言及は警告レベルまで
    result.violations.forEach(v => {
      expect(v.severity).not.toBe('high');
    });
  });
});
```

#### テストグループ 5: ステマ規制テスト

```typescript
describe('ステマ規制対応 (景表法)', () => {
  test('PR記事にPR表記が挿入されること', () => {
    const article = {
      isPR: true,
      content: '<p>AGA治療のご紹介</p>',
    };
    const processed = insertPrDisclosure(article);
    expect(processed.content).toMatch(/本記事はPRを含みます|広告を含む/);
  });

  test('アフィリリンクにrel="sponsored"が付与されること', () => {
    const html = '<a href="https://af.example.com/click">クリニックへ</a>';
    const processed = processAffiliateLinks(html);
    expect(processed).toContain('rel="sponsored"');
  });

  test('非PR記事にはPR表記が挿入されないこと', () => {
    const article = {
      isPR: false,
      content: '<p>AGAの基礎知識</p>',
    };
    const processed = insertPrDisclosure(article);
    expect(processed.content).not.toMatch(/本記事はPRを含みます/);
  });
});
```

---

## 3. Core Web Vitals 閾値設定

### 3.1 目標値

> **注意**: Google公式CWVは2024年にFIDをINP (Interaction to Next Paint) に置き換えました。

| 指標 | Good基準 | 本プロジェクト目標 | 測定方法 |
|------|---------|----------------|---------|
| **LCP** (最大コンテンツ描画) | ≤2.5s | **≤2.0s** | Playwright + PerformanceObserver |
| **INP** (インタラクション応答) ※FID後継 | ≤200ms | **≤150ms** | Playwright + PerformanceObserver |
| **CLS** (累積レイアウトシフト) | ≤0.1 | **≤0.05** | Playwright + PerformanceObserver |
| FCP (最初のコンテンツ描画) | ≤1.8s | **≤1.5s** | Lighthouse CI |
| TTFB (最初のバイト受信) | ≤800ms | **≤500ms** | Playwright Response timing |

### 3.2 Lighthouse スコア目標

| カテゴリ | 目標 | 備考 |
|---------|------|------|
| Performance | **≥90** | CWV 3指標が主因 |
| Accessibility | **≥95** | WCAG 2.1 AA準拠 |
| Best Practices | **≥95** | HTTPS・Security Headers |
| SEO | **≥95** | 構造化データ・meta情報 |

### 3.3 ページ別 LCP目標

| ページ | LCP目標 | 主な要因 |
|-------|--------|---------|
| トップページ | ≤1.8s | Hero画像 → `priority` + WebP |
| 記事詳細ページ | ≤2.0s | アイキャッチ画像 → Cloudinary最適化 |
| クリニック比較ページ | ≤2.5s | 比較表 → スケルトンUI + Suspense |
| カテゴリページ | ≤2.0s | サムネイル一覧 → lazy load |

---

## 4. E2Eテスト シナリオ設計

### 4.1 優先度マトリクス

| 優先度 | シナリオ | 根拠 |
|--------|---------|------|
| **P0** | アフィリリンクのrel="sponsored"確認 | 景表法必須 |
| **P0** | PR表記の全記事表示確認 | 景表法必須 |
| **P0** | 公開記事の薬機法NGスキャン | 薬機法必須 |
| **P0** | Safari ITP環境でのアフィリ計測確認 | 収益直結 |
| P1 | カテゴリ→記事→CV導線 | 収益 |
| P1 | 構造化データ出力確認 | SEO |
| P1 | ISR/PPR動作確認 | パフォーマンス |
| P2 | スマートフォン表示 | UX |
| P2 | 404ページ表示 | UX |

### 4.2 P0 シナリオ詳細

#### S-01: 薬機法NG表現が公開記事に含まれないこと

```
前提: 記事一覧ページにアクセス可能
手順:
  1. /articles にアクセス
  2. 最新10記事のURLを取得
  3. 各記事ページの article テキストを取得
  4. 辞書の全NGパターン (50件) に対して検索

期待結果: 全記事・全NGパターンで一致なし
```

#### S-02: PR表記の表示位置確認

```
前提: PR記事 (isPR: true) が1件以上存在
手順:
  1. PR記事URLにアクセス
  2. PR表記要素 ([data-testid="pr-disclosure"]) を取得
  3. 記事本文 (article) の位置を取得
  4. PR表記が記事本文冒頭200px以内に表示されていることを確認

期待結果: PR表記が記事冒頭に表示される
```

#### S-03: アフィリリンク確認 (rel属性 + ITP)

```
前提: AGA比較記事がある
手順:
  1. /articles/aga-clinic-comparison にアクセス
  2. 全アフィリリンクを取得
  3. rel="sponsored" 属性の存在確認
  4. target="_blank" のリンクが rel="noopener" も持つことを確認
  5. Safari User-Agentでアクセスし、クリックURLにトラッキングパラメータが存在することを確認

期待結果: 全アフィリリンクに rel="sponsored noopener" が設定されている
```

#### S-04: コンバージョン導線

```
手順:
  1. / (トップページ) にアクセス
  2. AGAカテゴリページへ遷移
  3. 記事一覧から1件を選択
  4. 記事内のCVボタン ([data-testid="cv-button"]) を確認
  5. CVボタンがビューポートの50%以上表示されていることを確認

期待結果: CVボタンが視認可能な位置に表示される
```

### 4.3 Playwright マルチブラウザ設定

| ブラウザ | 目的 |
|---------|------|
| Desktop Chrome | メイン動作確認 |
| Desktop Safari | ITP確認 (アフィリ計測) |
| Pixel 5 (Android Chrome) | モバイル表示確認 |
| iPhone 13 (Mobile Safari) | ITP確認 + iOS表示 |

---

## 5. アクセシビリティチェック項目 (WCAG 2.1 AA)

### 5.1 自動テスト (axe-core/playwright)

| チェック項目 | 基準 | ツール |
|------------|------|--------|
| 色コントラスト比 | 本文4.5:1以上、大テキスト3:1以上 | axe-core |
| alt属性 | コンテンツ画像に説明文必須 | axe-core + Playwright |
| フォームラベル | 全input要素にlabel関連付け | axe-core |
| 見出し階層 | h1→h2→h3の順序 | axe-core |
| キーボード操作 | Tabキーで全機能到達可能 | Playwright |
| ARIA属性 | 適切なrole・aria-label | axe-core |
| フォーカス表示 | フォーカス時に視認可能なアウトライン | Playwright |

### 5.2 テストコード例

```typescript
// tests/e2e/accessibility.spec.ts
import AxeBuilder from '@axe-core/playwright';

const TARGET_PAGES = ['/', '/categories/aga', '/articles/sample'];

for (const url of TARGET_PAGES) {
  test(`${url}: WCAG 2.1 AA準拠`, async ({ page }) => {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toHaveLength(0);
  });
}
```

---

## 6. テスト実装計画

### 6.1 タスク依存関係

```
[#2 Next.js セットアップ] ─┐
                           ├→ [#5 テスト基盤構築]
[#4 コンプライアンスチェッカー] ─┘
```

### 6.2 ブロック解除後の実装順序

| 順序 | 内容 | 前提タスク |
|------|------|---------|
| 1 | vitest.config.ts + playwright.config.ts | #2完了 |
| 2 | 辞書整合性テスト (Group 1) | 辞書ファイル存在 ✓ |
| 3 | チェッカーUnit Tests (Group 2-5) | #4完了 |
| 4 | コンポーネントテスト | #2完了 |
| 5 | E2E P0シナリオ | #2完了 |
| 6 | Lighthouse CI設定 | Vercelデプロイ後 |

### 6.3 設定ファイル概要

**vitest.config.ts**: `src/test/setup.ts`, jsdom環境, v8カバレッジ, コンプライアンスモジュールは100%カバレッジ強制
**playwright.config.ts**: 4ブラウザ並列, baseURL env対応, スクリーンショット失敗時保存

---

*作成: QA Agent — 2026年3月2日 | 辞書データ (50エントリ) 確認済み*
