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
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      margin: '0 0 20px', padding: '14px 18px',
      background: 'linear-gradient(90deg, #fef3c7, #fff7ed)',
      border: '1px solid #f59e0b', borderRadius: 12,
    }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#92400e' }}>
          Protect your videos — connect Google Drive
        </div>
        <div style={{ fontSize: 12.5, color: '#78350f', marginTop: 2, lineHeight: 1.45 }}>
          Finished videos are hosted temporarily and can expire. Connecting your Drive backs up
          every render automatically to your own account — free, takes 30 seconds.
        </div>
      </div>
      <Link href="/settings/integrations" style={{
        padding: '9px 16px', borderRadius: 9, background: '#92400e', color: '#fff',
        fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        Connect Google Drive
      </Link>
      <button
        onClick={() => { sessionStorage.setItem('cf-drive-banner-dismissed', '1'); setShow(false) }}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: '#92400e', fontSize: 16, cursor: 'pointer', padding: 4 }}
      >✕</button>
    </div>
  )
}
