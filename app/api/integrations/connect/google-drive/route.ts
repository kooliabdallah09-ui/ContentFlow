import { NextRequest, NextResponse } from 'next/server'
import { newOAuthState, setStateCookie, userFromBearer } from '@/lib/oauth-state'

// Signed-in users only: returns the Google authorize URL and sets the state
// cookie (see lib/oauth-state.ts). The page then navigates to the URL.
export async function POST(request: NextRequest) {
  const userId = await userFromBearer(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const clientId = process.env.GOOGLE_CLIENT_ID
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!clientId) return NextResponse.json({ error: 'Google Drive is not configured.' }, { status: 503 })

  const { state, nonce } = newOAuthState(userId, 'google-drive')
  const redirectUri = `${base}/api/integrations/callback/google-drive`

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // drive.file — only access files created by ContentFlow (least-privilege)
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
    access_type: 'offline',
    state,
    prompt: 'consent',
  })}`

  const res = NextResponse.json({ url })
  setStateCookie(res, 'google-drive', nonce)
  return res
}
