'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <span className="brand-mark" style={{ width: 30, height: 30 }}><Logo size={30} /></span>
          <div className="brand-name" style={{ fontSize: 16 }}>Content<em>flow</em></div>
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.05, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
            New <span style={{ fontStyle: 'italic' }}>password</span>.
          </h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: 0 }}>Choose a new password for your account.</p>
        </div>

        {done ? (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid #22c55e', color: '#22c55e', padding: '14px', borderRadius: 11, fontSize: 13 }}>
            Password updated! Redirecting to dashboard…
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{ background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 11, fontSize: 13 }}>
                {error}
              </div>
            )}
            <div className="form-row">
              <label className="form-label">New password</label>
              <input type="password" className="input" placeholder="Min. 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <div className="form-row">
              <label className="form-label">Confirm password</label>
              <input type="password" className="input" placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)} required disabled={loading} />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary"
              style={{ width: '100%', marginTop: 8, padding: '13px', opacity: loading ? 0.6 : 1, borderRadius: 11 }}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
