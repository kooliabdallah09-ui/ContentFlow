'use client'

import { getSupabase } from '@/lib/auth'

interface DriveSaveParams {
  sourceUrl: string
  filename: string
  mimeType: string
  contentType: string        // 'ugc' | 'video' | 'image' | 'voice' | 'screen-demo' etc.
  creditCost?: number
  metadata?: Record<string, string>
}

// Fire-and-forget hook — saves a generated file to the user's ContentFlow
// Drive folder after generation completes. Never blocks the UI on failure.
export function useDriveSync() {
  const autoSave = async (params: DriveSaveParams) => {
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      // Get a fresh Drive access token + folder ID from the server.
      const statusRes = await fetch('/api/drive/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!statusRes.ok) return
      const { connected, accessToken, folderId } = await statusRes.json()
      if (!connected || !accessToken || !folderId) return

      // Download the generated file
      const fileRes = await fetch(params.sourceUrl)
      if (!fileRes.ok) return
      const blob = await fileRes.blob()

      // Build multipart/related body (Drive API requires this format, not multipart/form-data)
      const boundary = `cf_${Date.now()}`
      const driveMetadata = {
        name: params.filename,
        parents: [folderId],
        appProperties: {
          contentType: params.contentType,
          sourceUrl: params.sourceUrl,
          creditCost: String(params.creditCost ?? 0),
          metadata: JSON.stringify(params.metadata ?? {}),
          cfVersion: '1',
        },
      }

      const metaStr = JSON.stringify(driveMetadata)
      const enc = new TextEncoder()
      const metaPart = enc.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaStr}\r\n`,
      )
      const fileHeader = enc.encode(`--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`)
      const fileBytes = new Uint8Array(await blob.arrayBuffer())
      const close = enc.encode(`\r\n--${boundary}--`)

      const body = new Uint8Array(metaPart.length + fileHeader.length + fileBytes.length + close.length)
      let offset = 0
      body.set(metaPart, offset); offset += metaPart.length
      body.set(fileHeader, offset); offset += fileHeader.length
      body.set(fileBytes, offset); offset += fileBytes.length
      body.set(close, offset)

      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`,
          },
          body,
        },
      )
    } catch (err) {
      // Silent fail — Drive sync is non-blocking
      console.debug('[useDriveSync] sync skipped:', err)
    }
  }

  return { autoSave }
}
