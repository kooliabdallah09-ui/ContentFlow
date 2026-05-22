'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowRight, Zap, Sparkles, Video, Mail } from 'lucide-react'

function CountUpStat({ target, label }: { target: number; label: string }) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    if (!hasStarted) return

    let current = 0
    const increment = Math.ceil(target / 30)
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(current)
      }
    }, 50)

    return () => clearInterval(timer)
  }, [hasStarted, target])

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasStarted(true)
      }
    }, { threshold: 0.5 })

    const element = document.getElementById(`stat-${label}`)
    if (element) observer.observe(element)

    return () => observer.disconnect()
  }, [label])

  return (
    <div id={`stat-${label}`} className="flex items-center gap-2">
      <span className="text-white font-bold">
        {count.toLocaleString()}
        {label.includes('creators') ? '+' : '+'}
      </span>
      <span>{label}</span>
    </div>
  )
}

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAnnual, setIsAnnual] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setEmail('')
      alert('Welcome to ContentFlow! Check your email.')
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        /* Animated gradient background */
        @keyframes gradientShift {
          0% { background: linear-gradient(135deg, #000000 0%, #0a0a2e 50%, #000000 100%); }
          50% { background: linear-gradient(135deg, #0a0a2e 0%, #16213e 50%, #0a0a2e 100%); }
          100% { background: linear-gradient(135deg, #000000 0%, #0a0a2e 50%, #000000 100%); }
        }

        /* Modern dark theme */
        .hero-section {
          background:
            radial-gradient(circle, rgba(255, 255, 255, 0.25) 2px, transparent 2px),
            linear-gradient(135deg, #000000 0%, #0a0a2e 50%, #000000 100%);
          background-size: 40px 40px, 100% 100%;
          background-position: 0 0, 0 0;
          position: relative;
          overflow: hidden;
          animation: gradientShift 15s ease-in-out infinite;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%);
          border-radius: 50%;
        }

        .hero-content {
          position: relative;
          z-index: 20;
        }

        .nav-glass {
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-primary {
          background: #ffffff;
          color: #000000;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-weight: 600;
          border: 1px solid #ffffff;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1);
        }

        .btn-primary:hover {
          background: #ffffff;
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(255, 255, 255, 0.2);
        }

        .btn-primary:active {
          transform: translateY(-2px);
        }

        .btn-secondary {
          background: transparent;
          color: #ffffff;
          border: 1.5px solid rgba(255, 255, 255, 0.5);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-weight: 600;
          position: relative;
          overflow: hidden;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: #ffffff;
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(255, 255, 255, 0.15);
        }

        .btn-secondary:active {
          transform: translateY(-2px);
        }

        .input-glass {
          background: rgba(255, 255, 255, 0.1);
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          transition: all 0.3s ease;
          backdrop-filter: blur(8px);
        }

        .input-glass::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .input-glass:focus {
          background: rgba(255, 255, 255, 0.15);
          border-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
          outline: none;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          backdrop-filter: blur(10px);
          animation: float 6s ease-in-out infinite;
        }

        .feature-card:nth-child(2) {
          animation-delay: 0.2s;
        }

        .feature-card:nth-child(3) {
          animation-delay: 0.4s;
        }

        .feature-card:nth-child(4) {
          animation-delay: 0.6s;
        }

        .feature-card:nth-child(5) {
          animation-delay: 0.8s;
        }

        .feature-card:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-12px);
          box-shadow: 0 20px 40px rgba(255, 255, 255, 0.1);
          animation-play-state: paused;
        }

        .pricing-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.4s ease;
          backdrop-filter: blur(10px);
        }

        .pricing-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .pricing-featured {
          background: rgba(255, 255, 255, 0.1);
          border: 1.5px solid rgba(255, 255, 255, 0.3);
        }

        .pricing-featured:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent);
        }

        /* Animated background elements */
        .background-glow {
          position: fixed;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        @keyframes float1 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }

        @keyframes float2 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(20px) translateX(-10px); }
        }

        @keyframes float3 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-15px) translateX(-15px); }
        }

        .glow-1 {
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.1) 40%, transparent 70%);
          border-radius: 50%;
          top: -300px;
          left: -300px;
          animation: float1 15s ease-in-out infinite;
          filter: blur(80px);
        }

        .glow-2 {
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(6, 182, 212, 0.1) 40%, transparent 70%);
          border-radius: 50%;
          top: 30%;
          right: -250px;
          animation: float2 18s ease-in-out infinite 2s;
          filter: blur(80px);
        }

        .glow-3 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, rgba(14, 165, 233, 0.08) 40%, transparent 70%);
          border-radius: 50%;
          bottom: -250px;
          left: 10%;
          animation: float3 20s ease-in-out infinite 4s;
          filter: blur(80px);
        }

        /* Background glows z-index */
        .hero-section .background-glow {
          z-index: 5;
        }

        /* Particle grid */
        .particle {
          position: absolute;
          width: 1px;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
        }

        @keyframes particles {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }

        .particle-animated {
          animation: particles 4s ease-in-out infinite;
        }
      `}</style>

      {/* Background Elements */}
      <div className="background-glow glow-1"></div>
      <div className="background-glow glow-2"></div>
      <div className="background-glow glow-3"></div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tight">
            ContentFlow
          </div>
          <div className="flex gap-12 items-center text-sm">
            <a href="#features" className="text-white/70 hover:text-white transition font-500">
              Features
            </a>
            <a href="#pricing" className="text-white/70 hover:text-white transition font-500">
              Pricing
            </a>
            <Link
              href="/auth/login"
              className="text-white/70 hover:text-white transition font-500"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section min-h-screen flex items-center justify-center px-8 pt-32">
        <div className="hero-content max-w-5xl w-full text-center relative z-10">
          {/* Main Headline - Bold, Large */}
          <h1 className="text-7xl md:text-8xl lg:text-9xl font-black mb-8 leading-tight tracking-tighter">
            Create content<br />that converts.
          </h1>

          {/* Subheading - Minimal, Clear */}
          <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto mb-12 leading-relaxed font-400">
            Generate SEO blogs, viral social posts, professional UGC videos, and more with Claude AI. All in minutes, not days.
          </p>

          {/* CTA - Bold Button */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <form onSubmit={handleSubscribe} className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="input-glass px-6 py-4 rounded-md w-full sm:w-auto text-sm"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary px-8 py-4 rounded-md font-700 text-sm whitespace-nowrap disabled:opacity-50 transition"
              >
                {loading ? 'Joining...' : 'Start Free'}
              </button>
            </form>
          </div>

          {/* Social Proof */}
          <div className="flex justify-center gap-8 items-center text-sm text-white/60">
            <CountUpStat target={2500} label="creators using" />
            <div className="divider" style={{ width: '1px', height: '20px' }}></div>
            <CountUpStat target={50000} label="pieces created" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-8 bg-black border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-24">
            <p className="text-white/50 font-600 text-sm uppercase tracking-widest mb-6">FEATURES</p>
            <h2 className="text-6xl md:text-7xl font-black mb-8 leading-tight">
              Everything you need<br />to win content.
            </h2>
            <p className="text-white/70 text-lg max-w-3xl mx-auto leading-relaxed">
              From blogs to videos, everything is generated with Claude AI and ready to publish instantly.
            </p>
          </div>

          {/* Feature Cards - Liquid Glass Layout */}
          <style>{`
            .liquid-glass-blue {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.65) 0%, rgba(37, 99, 235, 0.55) 100%);
              backdrop-filter: blur(30px);
              -webkit-backdrop-filter: blur(30px);
              border: 1.5px solid rgba(255, 255, 255, 0.4);
              color: white;
              box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.15), 0 8px 32px rgba(59, 130, 246, 0.2);
            }

            .liquid-glass-light {
              background: linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(248, 250, 252, 0.7) 100%);
              backdrop-filter: blur(30px);
              -webkit-backdrop-filter: blur(30px);
              border: 1.5px solid rgba(255, 255, 255, 0.6);
              box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.08);
            }

            .feature-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6rem;
              align-items: center;
            }

            @media (max-width: 768px) {
              .feature-grid {
                grid-template-columns: 1fr;
                gap: 2rem;
              }
            }

            .feature-liquid-card {
              padding: 3rem;
              border-radius: 2rem;
              transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
            }

            .feature-liquid-card:hover {
              transform: translateY(-8px);
              box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
            }

            .check-mark {
              display: inline-flex;
              align-items: center;
              gap: 0.75rem;
              margin-bottom: 1rem;
              font-size: 0.95rem;
              font-weight: 500;
            }

            .check-mark::before {
              content: '✓';
              color: #3b82f6;
              font-weight: 700;
              font-size: 1.2rem;
              flex-shrink: 0;
            }

            .liquid-glass-blue .check-mark::before {
              color: #ffffff;
            }
          `}</style>

          {/* Feature Grid - 2x2 Clean Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Blog Posts */}
            <div className="feature-card p-12 rounded-xl group">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black mb-2">Blog Posts</h3>
                  <p className="text-white/60 text-sm">SEO-optimized articles that rank</p>
                </div>
              </div>
              <p className="text-white/70 leading-relaxed text-base">
                Generate 600-3000 word articles optimized for search engines. With metadata, headers, and WordPress integration built-in.
              </p>
              <div className="mt-8 flex items-center text-white/50 group-hover:text-white/80 transition">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>

            {/* Social Posts */}
            <div className="feature-card p-12 rounded-xl group">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black mb-2">Social Posts</h3>
                  <p className="text-white/60 text-sm">Multi-platform content</p>
                </div>
              </div>
              <p className="text-white/70 leading-relaxed text-base">
                Create platform-optimized posts for Twitter, LinkedIn, Instagram, and more. With hashtags, tone, and engagement optimization.
              </p>
              <div className="mt-8 flex items-center text-white/50 group-hover:text-white/80 transition">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>

            {/* UGC Videos */}
            <div className="feature-card p-12 rounded-xl group">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black mb-2">UGC Videos</h3>
                  <p className="text-white/60 text-sm">AI avatars with lip-sync</p>
                </div>
              </div>
              <p className="text-white/70 leading-relaxed text-base">
                Generate professional product demos with AI avatars, natural voice, and lip-sync. Ready for TikTok, Reels, and YouTube Shorts.
              </p>
              <div className="mt-8 flex items-center text-white/50 group-hover:text-white/80 transition">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>

            {/* Email Sequences */}
            <div className="feature-card p-12 rounded-xl group">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black mb-2">Email Sequences</h3>
                  <p className="text-white/60 text-sm">Complete nurture flows</p>
                </div>
              </div>
              <p className="text-white/70 leading-relaxed text-base">
                Build entire email workflows that convert. With personalization, A/B testing templates, and automated sequencing.
              </p>
              <div className="mt-8 flex items-center text-white/50 group-hover:text-white/80 transition">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-8 bg-black border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-24">
            <p className="text-white/50 font-600 text-sm uppercase tracking-widest mb-6">PRICING</p>
            <h2 className="text-6xl md:text-7xl font-black mb-8">
              Simple, transparent<br />pricing.
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
              Choose a plan that works for you, from solo creators to teams and agencies.
            </p>

            {/* Pricing Toggle */}
            <div className="flex items-center justify-center gap-6 mb-12">
              <span className={`text-sm font-600 transition ${!isAnnual ? 'text-white' : 'text-white/60'}`}>
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-16 h-8 rounded-full transition-all ${
                  isAnnual
                    ? 'bg-green-400'
                    : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all transform ${
                    isAnnual ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-600 transition ${isAnnual ? 'text-white' : 'text-white/60'}`}>
                Annual
                {isAnnual && <span className="text-cyan-400 ml-2 text-xs">Save 20%</span>}
              </span>
            </div>
          </div>

          {/* Pricing Cards - Liquid Glass */}
          <style>{`
            .pricing-card {
              padding: 3rem;
              border-radius: 2rem;
              transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
            }

            .pricing-card:hover {
              transform: translateY(-8px);
            }

            .pricing-light {
              background: rgba(255, 255, 255, 0.6);
              backdrop-filter: blur(30px);
              -webkit-backdrop-filter: blur(30px);
              border: 1.5px solid rgba(255, 255, 255, 0.6);
              box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.08);
            }

            .pricing-featured {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.75) 0%, rgba(37, 99, 235, 0.65) 100%);
              backdrop-filter: blur(30px);
              -webkit-backdrop-filter: blur(30px);
              border: 1.5px solid rgba(255, 255, 255, 0.5);
              box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(59, 130, 246, 0.25);
              color: white;
            }

            .pricing-featured:hover {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.7) 100%);
              box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.25), 0 8px 32px rgba(59, 130, 246, 0.3);
            }

            .pricing-featured h3,
            .pricing-featured p,
            .pricing-featured .pricing-price,
            .pricing-featured .pricing-description {
              color: white;
            }

            .pricing-featured ul li {
              color: rgba(255, 255, 255, 0.95);
            }

            .pricing-badge {
              display: inline-block;
              background: rgba(255, 255, 255, 0.25);
              color: white;
              padding: 0.375rem 0.875rem;
              border-radius: 0.5rem;
              font-size: 0.75rem;
              font-weight: 600;
              margin-bottom: 1.5rem;
              border: 1px solid rgba(255, 255, 255, 0.4);
            }
          `}</style>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free */}
            <div className="pricing-card p-8 rounded-xl">
              <h3 className="text-xl font-black mb-2">Free</h3>
              <p className="text-white/60 text-xs mb-6">For testing</p>
              <div className="mb-8">
                <span className="text-4xl font-black">0€</span>
                <span className="text-xs text-white/60">/month</span>
              </div>
              <ul className="space-y-2 text-white/70 text-xs mb-8">
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> 50 credits/month</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> 150 bonus credits</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> All generators</li>
              </ul>
              <Link href="/auth/signup" className="btn-secondary w-full py-3 rounded-md font-600 text-xs text-center transition block">
                Get Started
              </Link>
            </div>

            {/* Starter */}
            <div className="pricing-card p-8 rounded-xl">
              <h3 className="text-xl font-black mb-2">Starter</h3>
              <p className="text-white/60 text-xs mb-6">For creators</p>
              <div className="mb-8">
                <span className="text-4xl font-black">19€</span>
                <span className="text-xs text-white/60">/month</span>
              </div>
              <ul className="space-y-2 text-white/70 text-xs mb-8">
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> 1,000 credits/month</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> UGC videos</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> Advanced analytics</li>
              </ul>
              <Link href="/auth/signup" className="btn-secondary w-full py-3 rounded-md font-600 text-xs text-center transition block">
                Start Free Trial
              </Link>
            </div>

            {/* Pro - Featured */}
            <div className="pricing-featured p-8 rounded-xl transform lg:scale-105 lg:relative lg:z-10">
              <div className="text-xs font-black text-white/80 uppercase tracking-widest mb-3">Most Popular</div>
              <h3 className="text-xl font-black mb-2 text-white">Pro</h3>
              <p className="text-white/80 text-xs mb-6">For serious creators</p>
              <div className="mb-8">
                <span className="text-4xl font-black text-white">49€</span>
                <span className="text-xs text-white/80">/month</span>
              </div>
              <ul className="space-y-2 text-white text-xs mb-8">
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> 4,000 credits/month</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> Premium avatars</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> Content calendar</li>
              </ul>
              <button className="btn-primary w-full py-3 rounded-md font-600 text-xs transition">
                Start Free Trial
              </button>
            </div>

            {/* Agency */}
            <div className="pricing-card p-8 rounded-xl">
              <h3 className="text-xl font-black mb-2">Agency</h3>
              <p className="text-white/60 text-xs mb-6">For teams</p>
              <div className="mb-8">
                <span className="text-4xl font-black">149€</span>
                <span className="text-xs text-white/60">/month</span>
              </div>
              <ul className="space-y-2 text-white/70 text-xs mb-8">
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> 15,000 credits/month</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> Multi-client dashboard</li>
                <li className="flex items-center gap-2"><Zap className="w-3 h-3" /> Priority support</li>
              </ul>
              <button className="btn-secondary w-full py-3 rounded-md font-600 text-xs transition">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-8 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-6xl md:text-7xl font-black mb-8 leading-tight">
            Ready to ship<br />better content?
          </h2>
          <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join 2,500+ creators and teams using ContentFlow to generate, publish, and scale their content.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="btn-primary inline-block px-10 py-5 rounded-md font-700 text-lg"
            >
              Start Free
            </Link>
            <Link
              href="/privacy"
              className="inline-block px-10 py-5 rounded-md font-700 text-lg border-2 border-white/20 hover:border-white text-white transition"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white/70 py-16 px-8 border-t border-white/10">
        <style>{`
          .footer-column h3 {
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 1.25rem;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }

          .footer-column a {
            display: block;
            color: #ffffff99;
            font-size: 0.95rem;
            margin-bottom: 0.875rem;
            transition: color 0.2s;
            text-decoration: none;
          }

          .footer-column a:hover {
            color: #ffffff;
          }
        `}</style>

        <div className="max-w-7xl mx-auto">
          {/* Main Footer */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-12">
            {/* Logo */}
            <div>
              <div className="text-2xl font-black text-white">ContentFlow</div>
            </div>

            {/* Resources */}
            <div className="footer-column">
              <h3>Resources</h3>
              <a href="#">Documentation</a>
              <a href="#">Blog</a>
              <a href="#">API</a>
            </div>

            {/* Support */}
            <div className="footer-column">
              <h3>Support</h3>
              <a href="#">Help Center</a>
              <a href="#">Contact</a>
              <a href="#">Status</a>
            </div>

            {/* Legal */}
            <div className="footer-column">
              <h3>Legal</h3>
              <a href="/privacy">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-white/10 pt-8">
            <p className="text-white/50 text-sm">© 2026 ContentFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
