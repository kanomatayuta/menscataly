# MENS CATALY - Claude Code Project Guide

## Project Overview
メンズカタリ (MENS CATALY) — AI自律型メンズ医療×美容アフィリエイトメディア
- Domain: menscataly.com / menscataly.jp
- KGI: 12ヶ月以内に月次収益30万円達成

## Tech Stack
- **Framework**: Next.js 16 (Turbopack, PPR/Cache Components)
- **CMS**: microCMS
- **Hosting**: Vercel
- **DB**: Supabase (PostgreSQL)
- **AI**: Claude Sonnet 4.6 (記事生成) / Claude Haiku 4.5 (分析)
- **Image**: Cloudinary + Ideogram API
- **Automation**: Cloud Scheduler + Cloud Run
- **Analytics**: BigQuery + Looker Studio + GA4

## Architecture
5層アーキテクチャ:
1. データ取得層 (06:00) - pytrends, feedparser, GSC API
2. AI処理層 (06:10-07:30) - Claude Haiku→Sonnet, 薬機法チェック
3. CMS・公開層 (07:30) - microCMS → Vercel ISR
4. ユーザー・収益化層 - ASP (afb, A8, アクセストレード等)
5. 分析・PDCA層 (23:00) - GA4, BigQuery, アラート

## Compliance Rules (MUST FOLLOW)
- 薬機法第66条・67条準拠 — NG表現は必ずOK表現に変換
- 景表法・ステマ規制 — 全記事にPR表記を挿入
- YMYL/E-E-A-T — 監修者情報、参考文献、更新日を必須表示
- Cookie/ITP — 各ASPのITP対応タグを実装

## NG Expression Examples (薬機法)
- NG: 「確実に髪が生える」 → OK: 「発毛を促進する効果が期待できる」
- NG: 「シミが完全に消える」 → OK: 「メラニンの生成を抑制する効果がある」
- NG: 「最安値」「業界No.1」 → OK: 「調査時点での価格」+調査日時表記
- NG: 「副作用なし」 → OK: 「副作用のリスクが低いとされている」+注釈

## Agent Team Structure
- **Lead Agent**: プロジェクト統括 (Opus 4.6)
- **Frontend Agent**: Next.js UI/UX → `feature/frontend-*`
- **Backend Agent**: API/Pipeline/DB → `feature/backend-*`
- **Content Agent**: 記事生成/SEO/薬機法 → `feature/content-*`
- **QA Agent**: テスト/品質管理 → `feature/qa-*`

## Key Documents
- `requirements_v3.0.md` — 要件定義書 (リサーチ反映版)
- `menscataly_media_design.docx` — 設計書 v2.0
- `menscataly_media_architecture.drawio` — アーキテクチャ図

## Development Conventions
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS
- Testing: Vitest + Playwright
- Linting: ESLint + Prettier
- Commit: Conventional Commits (feat:, fix:, docs:, etc.)
- Branch: Git Flow (main → develop → feature/*)
