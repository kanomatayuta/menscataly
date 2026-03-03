# ============================================================
# MENS CATALY - Cloud Run 用 Dockerfile
# Node.js 22 ベース
# パイプライン実行エントリーポイント
# ============================================================

# ============================================================
# Stage 1: 依存関係のインストール
# ============================================================
FROM node:22-alpine AS deps

WORKDIR /app

# package.json と lock ファイルをコピー
COPY package.json package-lock.json ./

# 本番依存関係のみインストール
RUN npm ci --omit=dev

# ============================================================
# Stage 2: ビルド
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# 全依存関係をインストール (devDependencies 含む)
COPY package.json package-lock.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScript ビルド (Next.js)
# Cloud Run では Next.js のスタンドアロン出力を使用
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================================
# Stage 3: 本番イメージ
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js スタンドアロン出力をコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# パイプライン実行スクリプトをコピー
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/pipeline ./src/lib/pipeline

USER nextjs

# ポート設定
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/pipeline/status || exit 1

# エントリーポイント: Next.js サーバー
# パイプラインは /api/pipeline/run エンドポイント経由で起動
CMD ["node", "server.js"]
