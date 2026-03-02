# Claude Code Agent Team セットアップガイド

## 概要
メンズカタリの開発・運用を担う4エージェント + 1リードのチーム構成。
3つのマルチエージェント手法を組み合わせて活用する。

---

## 手法1: サブエージェント (Agent ツール)

### 使い方
メインセッションから `Agent` ツールで並列タスクを起動する。

### 適したタスク
- 短時間で完結するリサーチ・調査
- 独立したファイルの生成・編集
- 並列テスト実行
- コードレビュー

### 使用例
```
# 3つのサブエージェントを並列起動
Agent(subagent_type="general-purpose", description="Frontend setup", ...)
Agent(subagent_type="general-purpose", description="Backend API design", ...)
Agent(subagent_type="general-purpose", description="Content prompt design", ...)
```

### 注意点
- サブエージェントは WebSearch/WebFetch の権限を自動継承しない
- Web系リサーチはメインセッションで実行すること
- ファイル操作系 (Read, Write, Edit, Glob, Grep, Bash) は利用可能

---

## 手法2: ワークツリー (Git Worktree)

### 使い方
各エージェントが独立したワークツリーで作業し、マージで統合する。

### ブランチ戦略
```
main                    ← 安定版 (本番デプロイ)
├── develop             ← 統合ブランチ
│   ├── feature/frontend-base-setup
│   ├── feature/frontend-article-template
│   ├── feature/backend-pipeline
│   ├── feature/backend-cms-integration
│   ├── feature/content-generator
│   ├── feature/content-compliance-checker
│   ├── feature/qa-unit-tests
│   └── feature/qa-e2e-tests
```

### セットアップ手順
```bash
# 1. Git リポジトリ初期化
cd /Users/kanomatayuta/menscataly
git init
git add -A
git commit -m "feat: initial project setup with requirements v3.0"

# 2. develop ブランチ作成
git checkout -b develop

# 3. 各エージェントのワークツリー作成
git worktree add .claude/worktrees/frontend feature/frontend-base-setup
git worktree add .claude/worktrees/backend feature/backend-pipeline
git worktree add .claude/worktrees/content feature/content-generator
git worktree add .claude/worktrees/qa feature/qa-unit-tests
```

### マージフロー
```
feature/* → develop (PR/レビュー) → main (リリース)
```

---

## 手法3: Claude Code SDK (カスタムオーケストレーション)

### 有効化
```bash
# 環境変数
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true
```

### settings.json に追加
```json
{
  "permissions": {
    "allow": [
      "Read", "Write", "Edit", "Glob", "Grep", "Bash",
      "WebSearch", "WebFetch", "Agent"
    ]
  }
}
```

### Agent Teams の活用場面
| 場面 | 適切な手法 |
|------|-----------|
| 短時間リサーチ | サブエージェント |
| 独立した機能開発 | ワークツリー + サブエージェント |
| 大規模なリファクタリング | Agent Teams (チーム連携) |
| コードレビュー | サブエージェント or Agent Teams |
| デバッグ (仮説検証) | Agent Teams (複数仮説並列) |

---

## チーム運用フロー

### 1. タスク分解 (Lead Agent)
```
ユーザーの要求
  ↓
Lead Agent がタスクを分解
  ↓
TaskCreate で各タスクを登録
  ↓
依存関係を設定 (blockedBy)
  ↓
各エージェントに並列割り当て
```

### 2. 開発フロー
```
Phase 0: 基盤構築
├── Frontend Agent: Next.js 16 セットアップ (worktree: frontend)
├── Backend Agent: Supabase + microCMS スキーマ設計 (worktree: backend)
├── Content Agent: プロンプト設計・薬機法辞書構築 (worktree: content)
└── QA Agent: テスト基盤構築 (worktree: qa)

→ Lead Agent: develop にマージ → 統合テスト → main
```

### 3. 日次運用フロー (Phase 1以降)
```
06:00  Backend Agent: データ収集パイプライン実行
06:10  Content Agent: AI分析・記事生成
07:30  Backend Agent: microCMS公開処理
23:00  QA Agent: 品質チェック・KPIモニタリング
```

---

## 今すぐ始めるには

### Step 1: Git 初期化
```bash
cd /Users/kanomatayuta/menscataly
git init
git add CLAUDE.md requirements_v3.0.md
git commit -m "feat: initial project setup"
```

### Step 2: Next.js プロジェクト作成
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --turbopack
```

### Step 3: エージェントチームで並列開発開始
メインセッションから各エージェントをサブエージェントとして起動し、
ワークツリーで独立して作業させる。

---

*最終更新: 2026年3月2日*
