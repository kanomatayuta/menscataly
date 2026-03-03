// Draft Mode 無効化エンドポイント
// GET /api/draft-disable
//
// プレビューモードを終了し、通常の公開ページに戻す

import { NextResponse } from 'next/server'
import { draftMode } from 'next/headers'

export async function GET() {
  const draft = await draftMode()
  draft.disable()

  return NextResponse.json({ draftMode: false })
}
