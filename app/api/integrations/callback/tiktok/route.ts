import { NextRequest, NextResponse } from 'next/server'
import { clearOAuthState, verifyOAuthState } from '@/lib/oauth-state'
import { adminDb, appUrl, exchangeCode, fetchTikTokUser, saveTikTokTokens } from '@/lib/integrations/tiktok'

export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(`${appUrl()}/settings/integrations?${q}`)
    clearOAuthState(res, 'tiktok')
    return res
  }
  const sp = req.nextUrl.searchParams
  if (sp.get('error')) return back('error=tiktok_denied')
  const code = sp.get('code')
  const userId = verifyOAuthState(req, sp.get('state'), 'tiktok')
  if (!code) return back('error=missing_params')
  if (!userId) return back('error=invalid_state')

  try {
    const tokens = await exchangeCode(code)
    const scopes = tokens.scope?.split(',') ?? []
    if (!scopes.includes('video.publish')) return back('error=tiktok_missing_permission')
    const profile = await fetchTikTokUser(tokens.access_token)
    await saveTikTokTokens(adminDb(), userId, tokens, profile)
    return back('success=tiktok')
  } catch (err) {
    console.error('[tiktok/callback]', err instanceof Error ? err.message : err)
    return back('error=callback_error')
  }
}
