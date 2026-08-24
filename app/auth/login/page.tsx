'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, getSupabase, signInWithGoogle } from '@/lib/auth'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

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
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      await signInWithGoogle()
      // Browser is being redirected to Google; nothing else to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

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
          <span className="brand-mark" style={{ width: 30, height: 30 }}><Logo size={30} /></span>
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

            {/* Google OAuth — one-click sign-in. Redirects to Supabase → Google → /auth/callback. */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '12px', borderRadius: 11,
                border: '1px solid var(--border-strong, var(--border))',
                background: '#fff', color: '#1f1f1f',
                fontSize: 14, fontWeight: 600, cursor: googleLoading ? 'wait' : 'pointer',
                opacity: googleLoading || loading ? 0.7 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.2 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.2 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.2-5.5l-6.6-5.4c-2 1.5-4.6 2.4-7.6 2.4-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.6 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.8-3.6 5.1l6.6 5.4c-.5.4 7.7-5.6 7.7-14.5 0-1.3-.1-2.4-.4-3.5z"/>
              </svg>
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: 0.4, textTransform: 'uppercase' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

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
