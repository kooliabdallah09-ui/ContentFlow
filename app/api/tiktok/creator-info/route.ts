import { NextRequest, NextResponse } from 'next/server'
import { userFromBearer } from '@/lib/oauth-state'
import { adminDb, queryCreatorInfo, tiktokAccessToken, tiktokErrorMessage } from '@/lib/integrations/tiktok'

// TikTok requires the posting screen to load the creator's CURRENT settings
// every time it opens (nickname, privacy options, disabled interactions, max length).
export async function GET(req: NextRequest) {
  const userId = await userFromBearer(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = adminDb()
  const token = await tiktokAccessToken(db, userId)
  if (!token) return NextResponse.json({ error: 'Connect TikTok first.', code: 'not_connected' }, { status: 409 })

  const { data, error } = await queryCreatorInfo(token)
  if (error.code !== 'ok') {
    return NextResponse.json({ error: tiktokErrorMessage(error.code), code: error.code }, { status: 409 })
  }
  return NextResponse.json({ creator: data })
}
