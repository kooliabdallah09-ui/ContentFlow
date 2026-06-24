import { SupabaseClient } from '@supabase/supabase-js'

const FOLDER_NAME = 'ContentFlow'

// Refresh the stored access token using the refresh token.
// Always called before any Drive API call to avoid 401s.
export async function getValidDriveToken(userId: string, supabase: SupabaseClient): Promise<string> {
  const { data: integration } = await supabase
    .from('integrations')
    .select('refresh_token')
    .eq('user_id', userId)
    .eq('platform', 'google-drive')
    .eq('is_connected', true)
    .single()

  if (!integration?.refresh_token) throw new Error('DRIVE_NOT_CONNECTED')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integration.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    // Token is dead — mark as disconnected
    await supabase
      .from('integrations')
      .update({ is_connected: false })
      .eq('user_id', userId)
      .eq('platform', 'google-drive')
    throw new Error('DRIVE_TOKEN_EXPIRED')
  }

  await supabase
    .from('integrations')
    .update({ access_token: tokenData.access_token })
    .eq('user_id', userId)
    .eq('platform', 'google-drive')

  return tokenData.access_token
}

// Get or lazily create the "ContentFlow" folder in the user's Drive.
// The folder ID is cached in integrations.account_id.
export async function getOrCreateFolder(accessToken: string, userId: string, supabase: SupabaseClient): Promise<string> {
  const { data: integration } = await supabase
    .from('integrations')
    .select('account_id')
    .eq('user_id', userId)
    .eq('platform', 'google-drive')
    .single()

  if (integration?.account_id) {
    // Verify the cached folder still exists
    const checkRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${integration.account_id}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (checkRes.ok) {
      const data = await checkRes.json()
      if (!data.trashed) return integration.account_id
    }
  }

  // Create the folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  const folder = await createRes.json()
  if (!folder.id) throw new Error('Failed to create Drive folder')

  await supabase
    .from('integrations')
    .update({ account_id: folder.id })
    .eq('user_id', userId)
    .eq('platform', 'google-drive')

  return folder.id
}

// List files in the ContentFlow folder, newest first.
export async function listDriveFiles(accessToken: string, folderId: string) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webContentLink,webViewLink,createdTime,appProperties)',
    orderBy: 'createdTime desc',
    pageSize: '200',
  })

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive list failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return (data.files ?? []) as DriveFile[]
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webContentLink: string
  webViewLink: string
  createdTime: string
  appProperties: Record<string, string>
}

// Map a Drive file to the LibraryItem shape the UI expects.
// sourceUrl in appProperties points to Supabase storage — used for media preview
// because Drive webContentLink requires a signed-in request.
export function driveFileToLibraryItem(file: DriveFile) {
  const ap = file.appProperties ?? {}
  let metadata: Record<string, unknown> = {}
  try { metadata = JSON.parse(ap.metadata ?? '{}') } catch { /* ignore */ }

  // sourceUrl = Supabase public URL (set on new uploads)
  // Falls back to our proxy endpoint which adds Drive auth headers server-side
  const storageUrl = ap.sourceUrl ?? `/api/drive/file/${file.id}`

  return {
    id: file.id,
    name: file.name,
    content_type: ap.contentType ?? 'video',
    storage_url: storageUrl,
    external_id: file.id,
    metadata,
    credit_cost: parseInt(ap.creditCost ?? '0', 10),
    created_at: file.createdTime,
    status: 'succeeded',
    drive_view_link: file.webViewLink,
  }
}
