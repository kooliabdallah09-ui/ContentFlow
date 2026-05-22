'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/auth'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(12px);
          border: 1.5px solid rgba(6, 182, 212, 0.15);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .input-glass {
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
          border: 1.5px solid rgba(6, 182, 212, 0.2);
          color: white;
          transition: all 0.3s ease;
          border-radius: 12px;
        }

        .input-glass::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .input-glass:focus {
          background: rgba(6, 182, 212, 0.08);
          border-color: rgba(6, 182, 212, 0.5);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15);
          outline: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #06B6D4, #0891B2);
          color: #ffffff;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.25);
          font-weight: 600;
          letter-spacing: -0.3px;
          border: none;
          border-radius: 12px;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(6, 182, 212, 0.35);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.25);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1.5px solid rgba(239, 68, 68, 0.3);
          color: #ff6b6b;
          border-radius: 12px;
          padding: 14px 18px;
          font-size: 14px;
          font-weight: 500;
        }

        .organic-shape {
          position: absolute;
          border-radius: 50%;
          opacity: 0.1;
        }

        .shape-1 {
          top: -200px;
          right: -100px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
        }

        .shape-2 {
          bottom: -100px;
          left: -100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%);
        }
      `}</style>

      <div className="organic-shape shape-1"></div>
      <div className="organic-shape shape-2"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-12">
          <Link href="/" className="inline-block">
            <div className="text-3xl font-black mb-8">
              Content<span className="text-cyan-400">Flow</span>
            </div>
          </Link>
          <h1 className="text-3xl font-black mb-3">Welcome back</h1>
          <p className="text-white/60">Sign in to continue creating amazing content</p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}

          <div>
            <label className="block text-sm font-500 text-white/70 mb-2">Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-lg text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-500 text-white/70 mb-2">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-lg text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 rounded-lg font-600 text-sm mt-6 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <p className="text-white/60">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-cyan-400 hover:text-cyan-300 font-600 transition">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
