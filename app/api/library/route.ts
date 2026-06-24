import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken, getOrCreateFolder, listDriveFiles, driveFileToLibraryItem } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    // Check if Drive is connected
    const { data: integration } = await supabase
      .from('integrations')
      .select('is_connected, account_name')
      .eq('user_id', userId)
      .eq('platform', 'google-drive')
      .single()

    if (!integration?.is_connected) {
      return NextResponse.json({ items: [], driveConnected: false })
    }

    // Fetch from Drive
    try {
      const accessToken = await getValidDriveToken(userId, supabase)
      const folderId = await getOrCreateFolder(accessToken, userId, supabase)
      const files = await listDriveFiles(accessToken, folderId)
      const items = files.map(driveFileToLibraryItem)
      return NextResponse.json({
        items,
        driveConnected: true,
        accountName: integration.account_name,
      })
    } catch (driveErr) {
      console.error('[library] Drive fetch failed:', driveErr)
      // Drive token expired or folder issue — tell the UI to prompt reconnect
      return NextResponse.json({ items: [], driveConnected: false, driveError: true })
    }
  } catch (err) {
    console.error('[library]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
