'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signup } from '@/lib/auth'
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
      await signup(email, password, fullName)
      router.push('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
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
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .input-glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          transition: all 0.3s ease;
        }

        .input-glass::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .input-glass:focus {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(0, 255, 0, 0.5);
          box-shadow: 0 0 0 3px rgba(0, 255, 0, 0.1);
          outline: none;
        }

        .btn-primary {
          background: #00ff00;
          color: #000000;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          box-shadow: 0 8px 24px rgba(0, 255, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          font-weight: 700;
          letter-spacing: -0.5px;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0, 255, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          background: #00dd00;
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ff6b6b;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
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
          background: radial-gradient(circle, rgba(0, 255, 0, 0.15) 0%, transparent 70%);
        }

        .shape-2 {
          bottom: -100px;
          left: -100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(0, 255, 0, 0.1) 0%, transparent 70%);
        }
      `}</style>

      <div className="organic-shape shape-1"></div>
      <div className="organic-shape shape-2"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-12">
          <Link href="/" className="inline-block">
            <div className="text-3xl font-black mb-8">
              Content<span className="text-green-400">Flow</span>
            </div>
          </Link>
          <h1 className="text-3xl font-black mb-3">Get started</h1>
          <p className="text-white/60">Create your account and start generating amazing content</p>
        </div>

        <form className="space-y-5" onSubmit={handleSignup}>
          {error && <div className="error-message">{error}</div>}

          <div>
            <label className="block text-sm font-500 text-white/70 mb-2">Full Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-lg text-sm"
              required
            />
          </div>

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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <p className="text-white/60">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-green-400 hover:text-green-300 font-600 transition">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
