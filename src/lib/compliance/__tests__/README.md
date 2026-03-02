# コンプライアンステスト README

## 実行可能なテスト (現時点)

```bash
# 辞書整合性テスト — 今すぐ実行可能 (checker.ts不要)
npx vitest run src/lib/compliance/__tests__/dictionaries.test.ts
```

## ブロック解除後に実行可能なテスト

タスク#4 (コンプライアンスチェッカー実装) 完了後:

1. `checker.test.ts` の先頭 import コメントを外す
2. モックの `checkCompliance` / `insertPrDisclosure` / `processAffiliateLinks` を削除
3. 実装の関数名・パスに合わせて import を調整
4. `npx vitest run src/lib/compliance/__tests__/checker.test.ts`

## テストケース数

| ファイル | テスト数 | 前提条件 |
|---------|---------|---------|
| dictionaries.test.ts | ~25件 | 辞書JSONのみ (即実行可能) |
| checker.test.ts | ~50件以上 | checker.ts実装後 |
