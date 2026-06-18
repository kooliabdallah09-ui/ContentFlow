'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

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

      router.push('/onboarding/plan')
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
            60 credits at signup — make your first UGC ad in minutes.
          </p>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 11, fontSize: 13 }}>
              {error}
            </div>
          )}

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
            <p className="help">At least 6 characters.</p>
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
