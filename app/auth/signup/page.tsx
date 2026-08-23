'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase, signInWithGoogle } from '@/lib/auth'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Signup failed')
      }

      const supabase = getSupabase()
      if (supabase) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw new Error(signInError.message)
      }

      localStorage.setItem('cf-new-user', '1')
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
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
            Start <span style={{ fontStyle: 'italic' }}>here</span>.
          </h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: 0 }}>
            30 credits at signup — make your first UGC ad in minutes.
          </p>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 11, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Google OAuth — fastest sign-up path. Skips the whole form. */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: 0.4, textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div className="form-row">
            <label className="form-label">Full name</label>
            <input type="text" className="input" placeholder="Your name"
              value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={loading} />
          </div>

          <div className="form-row">
            <label className="form-label">Email</label>
            <input type="email" className="input" placeholder="you@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
          </div>

          <div className="form-row">
            <label className="form-label">Password</label>
            <input type="password" className="input" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            <p className="help">At least 8 characters.</p>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, padding: '13px', opacity: loading ? 0.6 : 1, borderRadius: 11 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--ink)', fontWeight: 600, borderBottom: '1px solid var(--ink)' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
