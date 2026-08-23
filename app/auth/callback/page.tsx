'use client'

// Landing page for Supabase OAuth redirects (Google, etc.). The Supabase
// browser client automatically consumes the URL hash / code and creates a
// session — we just wait for it, run the one-time user init (credits +
// seed influencer), then send the user to the dashboard.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Signing you in…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) throw new Error('Auth client not ready')

        // Supabase JS reads the OAuth code / hash automatically on load.
        // Poll briefly for the session — usually appears within ~200ms.
        let session = null
        for (let i = 0; i < 25 && !cancelled; i++) {
          const { data } = await supabase.auth.getSession()
          if (data?.session) { session = data.session; break }
          await new Promise(r => setTimeout(r, 150))
        }
        if (!session) throw new Error('Sign-in didn\'t complete — please try again.')

        // Fire-and-await the idempotent init so first-timers get credits +
        // Sloane before we route them to the dashboard.
        setMessage('Setting up your workspace…')
        try {
          await fetch('/api/auth/init-user', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        } catch (initErr) {
          // Non-fatal — the dashboard will still load; init endpoint can be
          // re-called later. Just log so we know if it happens.
          console.warn('[auth/callback] init-user failed:', initErr)
        }

        if (!cancelled) router.replace('/dashboard')
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Sign-in failed')
      }
    })()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        {error ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)', marginBottom: 10 }}>Sign-in failed</div>
            <p style={{ fontSize: 14, color: 'var(--ink-mute)', marginBottom: 20 }}>{error}</p>
            <button onClick={() => router.replace('/auth/login')} className="btn btn-primary" style={{ padding: '11px 22px' }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: 34, height: 34, margin: '0 auto 14px',
              border: '3px solid var(--border)', borderTopColor: 'var(--ink)',
              borderRadius: '50%', animation: 'cf-spin 700ms linear infinite',
            }} />
            <div style={{ fontSize: 14, color: 'var(--ink-mute)' }}>{message}</div>
            <style>{`@keyframes cf-spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}
      </div>
    </div>
  )
}
