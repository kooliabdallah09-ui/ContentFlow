import { createClient } from '@supabase/supabase-js'
import { getValidDriveToken } from '@/lib/google-drive'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { id } = await params

  try {
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

    // Fetch file metadata to get storagePath before deleting
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

    // Delete from Drive
    const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!delRes.ok && delRes.status !== 204) {
      const err = await delRes.text()
      console.error('[library/delete] Drive error:', delRes.status, err)
      return Response.json({ error: 'Failed to delete from Drive' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[library/delete]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
