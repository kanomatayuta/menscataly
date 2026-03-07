# ASP各社申請ガイド

## 申請優先順位

1. **afb** — 医療・美容案件が豊富、承認率高い
2. **アクセストレード** — 医療系に強い、API提供あり
3. **felmat** — クローズドASP、高単価案件
4. **バリューコマース** — LinkSwitch対応、大手案件
5. **もしもアフィリエイト** — 初心者向け、Amazon/楽天連携

---

## 1. afb (アフィビー)

- **申請URL**: https://www.afi-b.com/
- **必要情報**: サイトURL (menscataly.com), カテゴリ (医療・健康), 月間PV目安
- **審査期間**: 3〜5営業日
- **API/データ取得**: afb管理画面からレポートCSVダウンロード
- **環境変数**: `AFB_PARTNER_ID`, `AFB_API_TOKEN`
- **ITP対応**: afi-b.com の1stパーティCookie対応スクリプトあり
- **注意事項**: 医療系案件は個別提携申請が必要

## 2. アクセストレード

- **申請URL**: https://www.accesstrade.ne.jp/
- **必要情報**: パートナー登録 → サイト情報登録
- **審査期間**: 3〜7営業日
- **API/データ取得**: ATステージAPI (JSON), レポートAPI
- **環境変数**: `ACCESSTRADE_PARTNER_ID`, `ACCESSTRADE_API_KEY`
- **ITP対応**: nct.js (1stパーティ計測)
- **注意事項**: 美容医療系は「ヘルス・ビューティー」カテゴリで申請

## 3. felmat (フェルマ)

- **申請URL**: https://www.felmat.net/
- **必要情報**: 媒体主登録 → サイト審査
- **審査期間**: 5〜10営業日 (クローズドASPのため厳格)
- **API/データ取得**: 管理画面レポート
- **環境変数**: `FELMAT_MEDIA_ID`, `FELMAT_API_KEY`
- **ITP対応**: fm.js スクリプト
- **注意事項**: 招待制の側面あり。サイトの品質が重要

## 4. バリューコマース

- **申請URL**: https://www.valuecommerce.ne.jp/
- **必要情報**: アフィリエイター登録 → サイト追加
- **審査期間**: 3〜5営業日
- **API/データ取得**: レポートAPI, LinkSwitch自動変換
- **環境変数**: `VALUECOMMERCE_SID`, `VALUECOMMERCE_PID`
- **ITP対応**: vc_bridge.js (1stパーティCookie)
- **注意事項**: LinkSwitchで通常リンクを自動アフィリエイトリンク化可能

## 5. もしもアフィリエイト

- **申請URL**: https://af.moshimo.com/
- **必要情報**: 会員登録 → サイト追加 → プログラム申請
- **審査期間**: 1〜3営業日 (比較的早い)
- **API/データ取得**: レポートCSV
- **環境変数**: `MOSHIMO_AFFILIATE_ID`
- **ITP対応**: result.js スクリプト
- **注意事項**: W報酬制度あり (もしも独自ボーナス)

---

## 申請時の共通準備

### サイト要件
- menscataly.com で10記事以上公開済み
- プライバシーポリシー・免責事項ページあり
- お問い合わせフォームあり
- 運営者情報の明記

### 申請後のシステム設定
1. ASP管理画面からプログラム提携申請
2. 提携承認後、アフィリエイトURLを取得
3. `/admin/asp` でプログラムにクリエイティブ（affiliateUrl, anchorText）を登録
4. Vercel環境変数に各ASPのAPIキーを設定
5. `src/lib/asp/reports/` にレポートプロバイダーを追加（必要に応じて）

### A8.net (設定済み)
- メディアID: a26030485942
- リンクマネージャー: fNJlQopxWhdG8A68EM39
- 環境変数: `A8_MEDIA_ID`, `NEXT_PUBLIC_A8_MEDIA_ID`, `NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID`
