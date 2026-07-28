'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { canAccessVoxStudio } from '@/lib/pov-access'
import { SectionTabs, VIDEO_STUDIO_TABS } from '@/components/SectionTabs'
import VoxStudioBuilder from '@/components/VoxStudioBuilder'

export default function VoxPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null)
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 60px' }}>
      <SectionTabs tabs={VIDEO_STUDIO_TABS} />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
          Build a <em>Vox video.</em>
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
          Topic in. Beat map, frames, voiceover, and stitched video — out in about 3 minutes.
        </p>
      </div>

      {loading ? null : !canAccessVoxStudio(email) ? (
        <div style={{ padding: '40px 24px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Vox Studio — Coming Soon</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-dim)', maxWidth: 340, margin: '0 auto' }}>
            Narrated explainer videos with editorial visuals are in alpha. We&apos;ll let you know when access opens.
          </div>
        </div>
      ) : (
        <VoxStudioBuilder />
      )}
    </div>
  )
}
