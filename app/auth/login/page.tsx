'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, getSupabase } from '@/lib/auth'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setResetLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <span className="brand-mark" style={{ width: 30, height: 30 }}><img src="/logo-icon.png" alt="ContentFlow" /></span>
          <div className="brand-name" style={{ fontSize: 16 }}>Content<em>flow</em></div>
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.05, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
            Welcome <span style={{ fontStyle: 'italic' }}>back</span>.
          </h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: 0 }}>
            Sign in to keep creating.
          </p>
        </div>

        {resetMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {resetSent ? (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid #22c55e', color: '#22c55e', padding: '12px 14px', borderRadius: 11, fontSize: 13, lineHeight: 1.5 }}>
                Check your inbox — a reset link has been sent to <strong>{resetEmail}</strong>.
              </div>
            ) : (
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {error && (
                  <div style={{ background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 11, fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <p style={{ fontSize: 14, color: 'var(--ink-mute)', margin: 0 }}>
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
                <div className="form-row">
                  <label className="form-label">Email</label>
                  <input type="email" className="input" placeholder="you@email.com"
                    value={resetEmail} onChange={e => setResetEmail(e.target.value)} required disabled={resetLoading} />
                </div>
                <button type="submit" disabled={resetLoading} className="btn btn-primary"
                  style={{ width: '100%', padding: '13px', opacity: resetLoading ? 0.6 : 1, borderRadius: 11 }}>
                  {resetLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}
            <button type="button" onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{ background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 11, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div className="form-row">
              <label className="form-label">Email</label>
              <input type="email" className="input" placeholder="you@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>

            <div className="form-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Password</label>
                <button type="button" onClick={() => { setResetMode(true); setResetEmail(email); setError('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
                  Mot de passe oublié ?
                </button>
              </div>
              <input type="password" className="input" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary"
              style={{ width: '100%', marginTop: 8, padding: '13px', opacity: loading ? 0.6 : 1, borderRadius: 11 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
          New here?{' '}
          <Link href="/auth/signup" style={{ color: 'var(--ink)', fontWeight: 600, borderBottom: '1px solid var(--ink)' }}>
            Create an account
          </Link>
        </div>
      </div>
    </div>
  )
}
