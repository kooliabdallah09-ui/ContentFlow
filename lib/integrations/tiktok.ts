// TikTok Login Kit + Content Posting API (Direct Post).
// Docs: developers.tiktok.com/docs/en/content-posting-api-get-started
// UX rules we must follow: developers.tiktok.com/docs/en/content-sharing-guidelines
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const API = 'https://open.tiktokapis.com/v2'
export const TIKTOK_SCOPES = 'user.info.basic,video.publish,video.upload'

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://contentflow-web.com').replace(/\/$/, '')
export const tiktokRedirectUri = () => `${appUrl()}/api/integrations/callback/tiktok`

export function tiktokAuthorizeUrl(state: string): string {
  return `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    response_type: 'code',
    scope: TIKTOK_SCOPES,
    redirect_uri: tiktokRedirectUri(),
    state,
  })}`
}

type TokenResponse = {
  access_token: string; expires_in: number; open_id: string
  refresh_token: string; refresh_expires_in: number; scope: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...body,
    }),
  })
  const json = await res.json().catch(() => ({}))
  const data = (json.data ?? json) as Partial<TokenResponse> & { error?: string; error_description?: string }
  if (!data.access_token) throw new Error(data.error_description || data.error || `TikTok token request failed (${res.status})`)
  return data as TokenResponse
}

export const exchangeCode = (code: string) =>
  tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: tiktokRedirectUri() })

export async function revokeToken(token: string) {
  await fetch(`${API}/oauth/revoke/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, token }),
  }).catch(() => {})
}

export async function fetchTikTokUser(accessToken: string) {
  const res = await fetch(`${API}/user/info/?fields=open_id,display_name,avatar_url`, { headers: { Authorization: `Bearer ${accessToken}` } })
  const json = await res.json().catch(() => ({}))
  return (json?.data?.user ?? {}) as { open_id?: string; display_name?: string; avatar_url?: string }
}

export const adminDb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const expiry = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString()

/** Save a fresh token set. TikTok rotates refresh tokens, so always store the new one. */
export async function saveTikTokTokens(db: SupabaseClient, userId: string, t: TokenResponse, profile?: { display_name?: string; avatar_url?: string }) {
  const row: Record<string, unknown> = {
    user_id: userId, platform: 'tiktok', account_id: t.open_id,
    access_token: t.access_token, refresh_token: t.refresh_token,
    access_expires_at: expiry(t.expires_in), refresh_expires_at: expiry(t.refresh_expires_in),
    is_connected: true,
  }
  if (profile) {
    row.account_name = profile.display_name || t.open_id
    row.avatar_url = profile.avatar_url ?? null
    row.connected_at = new Date().toISOString()
  }
  const { error } = await db.from('integrations').upsert(row, { onConflict: 'user_id,platform' })
  if (error) throw new Error(`Could not save TikTok connection: ${error.message}`)
}

/** A valid access token for the user, refreshing it if it expires within 5 minutes. */
export async function tiktokAccessToken(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from('integrations')
    .select('access_token, refresh_token, access_expires_at, is_connected')
    .eq('user_id', userId).eq('platform', 'tiktok').maybeSingle()
  if (!data?.is_connected || !data.access_token) return null
  const exp = data.access_expires_at ? new Date(data.access_expires_at).getTime() : 0
  if (exp - Date.now() > 5 * 60 * 1000) return data.access_token
  if (!data.refresh_token) return null
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: data.refresh_token })
    await saveTikTokTokens(db, userId, t)
    return t.access_token
  } catch {
    // Refresh token expired or revoked: the user has to reconnect.
    await db.from('integrations').update({ is_connected: false }).eq('user_id', userId).eq('platform', 'tiktok')
    return null
  }
}

export type CreatorInfo = {
  creator_avatar_url?: string
  creator_username?: string
  creator_nickname?: string
  privacy_level_options: string[]
  comment_disabled: boolean
  duet_disabled: boolean
  stitch_disabled: boolean
  max_video_post_duration_sec: number
}

type ApiError = { code: string; message: string }

async function postJson<T>(path: string, accessToken: string, body: unknown): Promise<{ data: T; error: ApiError; status: number }> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({}))
  return { data: json.data as T, error: (json.error ?? { code: `http_${res.status}`, message: '' }) as ApiError, status: res.status }
}

export const queryCreatorInfo = (accessToken: string) =>
  postJson<CreatorInfo>('/post/publish/creator_info/query/', accessToken, {})

export type DirectPostInput = {
  title: string
  privacyLevel: string
  disableComment: boolean
  disableDuet: boolean
  disableStitch: boolean
  brandOrganic: boolean
  brandedContent: boolean
  videoUrl: string
}

export const initDirectPost = (accessToken: string, p: DirectPostInput) =>
  postJson<{ publish_id: string }>('/post/publish/video/init/', accessToken, {
    post_info: {
      title: p.title,
      privacy_level: p.privacyLevel,
      disable_comment: p.disableComment,
      disable_duet: p.disableDuet,
      disable_stitch: p.disableStitch,
      brand_organic_toggle: p.brandOrganic,
      brand_content_toggle: p.brandedContent,
      // Every ContentFlow video is AI-made: always apply TikTok's AI-generated label.
      is_aigc: true,
    },
    // PULL_FROM_URL is what TikTok asks for when the file is already on our
    // server; the URL must be on a domain verified in the developer portal.
    source_info: { source: 'PULL_FROM_URL', video_url: p.videoUrl },
  })

export const fetchPostStatus = (accessToken: string, publishId: string) =>
  postJson<{ status: string; fail_reason?: string; publicaly_available_post_id?: number[] }>(
    '/post/publish/status/fetch/', accessToken, { publish_id: publishId })

/** Plain-language message for TikTok error codes users can hit. */
export function tiktokErrorMessage(code: string): string {
  switch (code) {
    case 'spam_risk_too_many_posts': return 'This TikTok account has hit its daily posting limit. Try again later.'
    case 'spam_risk_user_banned_from_posting': return 'TikTok is not allowing this account to post right now.'
    case 'reached_active_user_cap': return 'Posting to TikTok is limited while ContentFlow is in TikTok review. Try again later.'
    case 'access_token_invalid': case 'scope_not_authorized': return 'Your TikTok connection expired. Reconnect TikTok in Settings → Integrations.'
    case 'rate_limit_exceeded': return 'Too many requests to TikTok. Wait a minute and try again.'
    case 'unaudited_client_can_only_post_to_private_accounts': return 'Until ContentFlow passes TikTok review, you can only post to a private TikTok account.'
    case 'privacy_level_option_mismatch': return 'That privacy option is not available for this account.'
    case 'url_ownership_unverified': return 'TikTok could not fetch the video (domain not verified yet).'
    default: return 'TikTok could not complete the request. Try again in a moment.'
  }
}
