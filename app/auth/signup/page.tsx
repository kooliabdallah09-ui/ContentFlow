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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center px-6 overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        .serif-headline {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          letter-spacing: -1.5px;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.6);
        }

        .input-glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: #1e293b;
          transition: all 0.3s ease;
        }

        .input-glass::placeholder {
          color: rgba(30, 41, 59, 0.5);
        }

        .input-glass:focus {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          outline: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(59, 130, 246, 0.35);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .text-gradient {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #991b1b;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
        }

        .organic-shape {
          position: absolute;
          border-radius: 50%;
          opacity: 0.05;
        }

        .shape-1 {
          top: -200px;
          right: -100px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%);
        }

        .shape-2 {
          bottom: -100px;
          left: -100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
        }
      `}</style>

      <div className="organic-shape shape-1"></div>
      <div className="organic-shape shape-2"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-12">
          <Link href="/" className="inline-block">
            <div className="serif-headline text-3xl text-slate-900 mb-8">
              Content<span className="text-gradient">Flow</span>
            </div>
          </Link>
          <h1 className="serif-headline text-3xl text-slate-900 mb-3">Get started</h1>
          <p className="text-slate-600">Create your account and start generating amazing content</p>
        </div>

        <form className="space-y-5" onSubmit={handleSignup}>
          {error && <div className="error-message">{error}</div>}

          <div>
            <label className="block text-sm font-500 text-slate-700 mb-2">Full Name</label>
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
            <label className="block text-sm font-500 text-slate-700 mb-2">Email</label>
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
            <label className="block text-sm font-500 text-slate-700 mb-2">Password</label>
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
          <p className="text-slate-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-600 transition">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
