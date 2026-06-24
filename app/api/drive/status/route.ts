import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken, getOrCreateFolder } from '@/lib/google-drive'

// Returns Drive connection status + a fresh access token + folder ID so the
// client can upload directly to Drive without proxying through this server.
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ connected: false })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ connected: false })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData?.user?.id) return NextResponse.json({ connected: false })

    const userId = userData.user.id

    // Check if Drive is connected
    const { data: integration } = await supabase
      .from('integrations')
      .select('account_name, is_connected')
      .eq('user_id', userId)
      .eq('platform', 'google-drive')
      .single()

    if (!integration?.is_connected) return NextResponse.json({ connected: false })

    // Refresh token + get/create folder (lazy init)
    let accessToken: string
    let folderId: string
    try {
      accessToken = await getValidDriveToken(userId, supabase)
      folderId = await getOrCreateFolder(accessToken, userId, supabase)
    } catch {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      accountName: integration.account_name,
      accessToken,
      folderId,
    })
  } catch (err) {
    console.error('[drive/status]', err)
    return NextResponse.json({ connected: false })
  }
}
