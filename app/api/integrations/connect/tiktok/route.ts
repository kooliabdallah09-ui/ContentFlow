import { NextRequest, NextResponse } from 'next/server'
import { newOAuthState, setStateCookie, userFromBearer } from '@/lib/oauth-state'
import { tiktokAuthorizeUrl } from '@/lib/integrations/tiktok'

// Signed-in users only: returns the TikTok authorize URL and sets the state
// cookie. The page then navigates to the URL.
export async function POST(req: NextRequest) {
  const userId = await userFromBearer(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    return NextResponse.json({ error: 'TikTok is not configured yet.' }, { status: 503 })
  }
  const { state, nonce } = newOAuthState(userId, 'tiktok')
  const res = NextResponse.json({ url: tiktokAuthorizeUrl(state) })
  setStateCookie(res, 'tiktok', nonce)
  return res
}
