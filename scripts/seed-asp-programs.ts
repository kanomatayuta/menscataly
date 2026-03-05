/**
 * ASPプログラム シードスクリプト
 *
 * src/lib/asp/seed.ts の 24 プログラムを Supabase asp_programs テーブルに upsert する。
 * program_id をコンフリクトキーとして使用。
 *
 * Usage:
 *   npx tsx scripts/seed-asp-programs.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { ASP_SEED_DATA } from '../src/lib/asp/seed'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('[seed-asp] Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`[seed-asp] Seeding ${ASP_SEED_DATA.length} ASP programs...`)

  let successCount = 0
  let errorCount = 0

  for (const program of ASP_SEED_DATA) {
    const row = {
      asp_name: program.aspName,
      program_name: program.programName,
      program_id: program.programId,
      category: program.category,
      reward_tiers: program.rewardTiers,
      approval_rate: program.approvalRate,
      epc: program.epc,
      itp_support: program.itpSupport,
      cookie_duration: program.cookieDuration,
      is_active: program.isActive,
      recommended_anchors: program.recommendedAnchors,
    }

    const { error } = await supabase
      .from('asp_programs')
      .upsert(row, { onConflict: 'program_id' })

    if (error) {
      console.error(`[seed-asp] FAIL: ${program.programName} (${program.programId}) - ${error.message}`)
      errorCount++
    } else {
      console.log(`[seed-asp] OK: ${program.programName} (${program.programId})`)
      successCount++
    }
  }

  console.log(`\n[seed-asp] Done: ${successCount} succeeded, ${errorCount} failed out of ${ASP_SEED_DATA.length} total.`)

  if (errorCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[seed-asp] Unexpected error:', err)
  process.exit(1)
})
