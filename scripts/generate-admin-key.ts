#!/usr/bin/env tsx
/**
 * ADMIN_API_KEY 生成スクリプト
 *
 * Usage: npx tsx scripts/generate-admin-key.ts
 *
 * 生成されたキーを Vercel 環境変数に設定してください:
 *   vercel env add ADMIN_API_KEY
 */

import { randomBytes } from 'crypto'

const key = `mcat_${randomBytes(32).toString('hex')}`

console.log('═══════════════════════════════════════════════')
console.log('  ADMIN_API_KEY を生成しました')
console.log('═══════════════════════════════════════════════')
console.log()
console.log(`  ${key}`)
console.log()
console.log('  以下のコマンドで Vercel に設定:')
console.log('  vercel env add ADMIN_API_KEY')
console.log()
console.log('  または .env.local に追記:')
console.log(`  ADMIN_API_KEY=${key}`)
console.log('═══════════════════════════════════════════════')
