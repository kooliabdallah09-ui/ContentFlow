'use client'

// Prominent prompt shown to users who haven't connected Google Drive.
// Framed as protection: finished videos are hosted temporarily by the
// render service, and Drive is the free permanent backup.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

export function DriveConnectBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('cf-drive-banner-dismissed')) return
    ;(async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) return
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (!token) return
        const res = await fetch('/api/drive/status', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!json?.connected) setShow(true)
      } catch { /* banner is best-effort */ }
    })()
  }, [])

  if (!show) return null

  return (
    <div className="drive-banner" style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      margin: '0 0 20px', padding: '14px 18px',
      background: 'var(--brand-soft)',
      border: '1px solid var(--brand)', borderRadius: 6,
    }}>
      <span className="drive-banner-icon" style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
      <div className="drive-banner-text" style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand-ink)' }}>
          <span className="drive-banner-long">Protect your videos — connect Google Drive</span>
          <span className="drive-banner-short">Back up your videos to Drive</span>
        </div>
        <div className="drive-banner-desc" style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.45 }}>
          Finished videos are hosted temporarily and can expire. Connecting your Drive backs up
          every render automatically to your own account — free, takes 30 seconds.
        </div>
      </div>
      <Link href="/settings/integrations" className="drive-banner-cta" style={{
        padding: '9px 16px', borderRadius: 5, background: 'var(--brand)', color: 'var(--on-brand)',
        fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        <span className="drive-banner-long">Connect Google Drive</span>
        <span className="drive-banner-short">Connect</span>
      </Link>
      <button
        onClick={() => { sessionStorage.setItem('cf-drive-banner-dismissed', '1'); setShow(false) }}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: 'var(--brand-ink)', fontSize: 16, cursor: 'pointer', padding: 4 }}
      >✕</button>
    </div>
  )
}
