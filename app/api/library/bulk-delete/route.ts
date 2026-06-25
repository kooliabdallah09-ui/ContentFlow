import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken } from '@/lib/google-drive'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userData.user.id
    const accessToken = await getValidDriveToken(userId, supabase)

    // Delete each file from Drive (and clean up Supabase storage if applicable)
    const results = await Promise.allSettled(ids.map(async (id: string) => {
      // Fetch metadata to get storagePath
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?fields=id,appProperties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (metaRes.ok) {
        const meta = await metaRes.json()
        const storagePath = meta.appProperties?.storagePath
        if (storagePath) {
          supabase.storage.from('ugc-assets').remove([storagePath]).catch(() => {})
        }
      }

      const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!delRes.ok && delRes.status !== 204) {
        throw new Error(`Drive delete failed for ${id}: ${delRes.status}`)
      }
    }))

    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) {
      console.error('[bulk-delete] Some deletions failed:', results)
      return Response.json({ error: `${failed} item(s) could not be deleted` }, { status: 500 })
    }

    return Response.json({ success: true, deleted: ids.length })
  } catch (err) {
    console.error('[bulk-delete]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
