'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
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

        /* Hero Background with vibrant blue gradient */
        .hero-section {
          background: linear-gradient(135deg, #1e88d8 0%, #2196f3 25%, #29b6f6 50%, #2196f3 100%);
          position: relative;
          overflow: hidden;
        }

        .hero-section::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.8));
          pointer-events: none;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          top: -200px;
          right: -100px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
          border-radius: 50%;
        }

        .hero-content {
          position: relative;
          z-index: 10;
        }

        /* Glass morphism with refined colors */
        .glass-card {
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
        }

        .glass-card:hover {
          background: rgba(255, 255, 255, 0.55);
          border-color: rgba(255, 255, 255, 0.8);
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(59, 130, 246, 0.12);
        }

        .nav-glass {
          background: rgba(248, 250, 252, 0.7);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.5);
        }

        /* Buttons */
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(59, 130, 246, 0.35);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.5);
          color: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(8px);
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(255, 255, 255, 0.8);
          transform: translateY(-2px);
        }

        /* Input styling */
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

        /* Feature cards with better spacing */
        .feature-item {
          transition: all 0.4s cubic-bezier(0.23, 1, 0.320, 1);
        }

        .feature-item:hover {
          transform: translateY(-8px);
        }

        .feature-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.1));
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          backdrop-filter: blur(8px);
        }

        /* Smooth line separator */
        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(59, 130, 246, 0.2), transparent);
        }

        /* Pricing card glow */
        .pricing-featured {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
          border: 1.5px solid rgba(59, 130, 246, 0.3);
        }

        .pricing-featured:hover {
          border-color: rgba(59, 130, 246, 0.5);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
        }

        /* Smooth gradient text */
        .text-gradient {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Subtle animations */
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .float-animation {
          animation: float 3s ease-in-out infinite;
        }

        /* Feature list styling */
        .feature-list li {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .feature-list li::before {
          content: '✓';
          color: #3b82f6;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Soft white fade elements */
        @keyframes fadeFloat1 {
          0%, 100% { opacity: 0; transform: translateY(20px) translateX(0px); }
          50% { opacity: 0.3; }
        }

        @keyframes fadeFloat2 {
          0%, 100% { opacity: 0; transform: translateY(-20px) translateX(10px); }
          50% { opacity: 0.25; }
        }

        @keyframes fadeFloat3 {
          0%, 100% { opacity: 0; transform: translateY(10px) translateX(-15px); }
          50% { opacity: 0.2; }
        }

        @keyframes fadeFloat4 {
          0%, 100% { opacity: 0; transform: translateY(-10px) translateX(20px); }
          50% { opacity: 0.28; }
        }

        .white-fade {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, transparent 70%);
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .fade-1 {
          width: 250px;
          height: 250px;
          top: 15%;
          left: 10%;
          animation: fadeFloat1 8s ease-in-out infinite;
        }

        .fade-2 {
          width: 180px;
          height: 180px;
          top: 35%;
          right: 15%;
          animation: fadeFloat2 7s ease-in-out infinite 1s;
        }

        .fade-3 {
          width: 200px;
          height: 200px;
          bottom: 25%;
          left: 20%;
          animation: fadeFloat3 9s ease-in-out infinite 0.5s;
        }

        .fade-4 {
          width: 150px;
          height: 150px;
          top: 50%;
          right: 5%;
          animation: fadeFloat4 10s ease-in-out infinite 2s;
        }

        .fade-5 {
          width: 220px;
          height: 220px;
          bottom: 10%;
          right: 25%;
          animation: fadeFloat1 11s ease-in-out infinite 1.5s;
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="serif-headline text-2xl text-slate-900">
            Content<span className="text-gradient">Flow</span>
          </div>
          <div className="flex gap-8 items-center text-sm">
            <a href="#features" className="text-slate-700 hover:text-blue-600 transition font-500">
              Features
            </a>
            <a href="#pricing" className="text-slate-700 hover:text-blue-600 transition font-500">
              Pricing
            </a>
            <Link
              href="/auth/login"
              className="text-slate-700 hover:text-blue-600 transition font-500"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="hero-content max-w-4xl w-full text-center relative z-10">
          {/* Badge */}
          <div className="mb-8 inline-block">
            <span className="glass-card px-4 py-2 rounded-full text-sm font-500 text-white/90 backdrop-blur-md bg-white/20">
              ✨ AI Content in Minutes
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="serif-headline text-6xl md:text-7xl mb-6 leading-tight text-white">
            Create content<br />that actually converts
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed font-300">
            From SEO blogs to viral social posts to email sequences. Generated with real intelligence, not generic templates.
          </p>

          {/* CTA Section */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <form onSubmit={handleSubscribe} className="flex gap-3 w-full sm:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-glass px-6 py-3 rounded-lg w-full sm:w-auto text-sm"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary px-8 py-3 rounded-lg font-600 text-sm whitespace-nowrap disabled:opacity-50 transition"
              >
                {loading ? 'Joining...' : 'Get Started'}
              </button>
            </form>
          </div>

          {/* Trust indicators */}
          <div className="flex justify-center gap-10 items-center text-sm text-white/80">
            <div>
              <div className="font-700 text-white text-lg">2,500+</div>
              <div className="text-sm">creators</div>
            </div>
            <div className="divider" style={{ height: '20px', background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent)' }}></div>
            <div>
              <div className="font-700 text-white text-lg">50K+</div>
              <div className="text-sm">pieces</div>
            </div>
            <div className="divider" style={{ height: '20px', background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent)' }}></div>
            <div>
              <div className="font-700 text-white text-lg">4.9★</div>
              <div className="text-sm">rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-gradient-to-b from-transparent via-slate-50 to-transparent">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-20">
            <p className="text-blue-600 font-600 text-sm uppercase tracking-wide mb-4">What You Get</p>
            <h2 className="serif-headline text-5xl text-slate-900 mb-4">
              Three generators.<br />Infinite possibilities.
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Build once, publish everywhere. Powered by Claude AI.
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

          <div className="feature-grid">
            {/* Left Card - Blue Gradient */}
            <div className="feature-liquid-card liquid-glass-blue">
              <h3 className="serif-headline text-3xl mb-6">Content Generation</h3>
              <p className="text-base leading-relaxed mb-8 opacity-95">
                Create high-quality content in seconds. Choose from three powerful generators tailored for different platforms and purposes.
              </p>
              <div className="space-y-4">
                <div className="check-mark">Blog posts: SEO-optimized, 600-3000 words</div>
                <div className="check-mark">Social posts: Platform-optimized for all networks</div>
                <div className="check-mark">Email sequences: Complete nurture flows</div>
                <div className="check-mark">Full AI enhancement with Claude</div>
              </div>
            </div>

            {/* Right Card - Light Glass */}
            <div className="feature-liquid-card liquid-glass-light">
              <h3 className="serif-headline text-3xl text-slate-900 mb-6">Smart Publishing</h3>
              <p className="text-slate-700 text-base leading-relaxed mb-8">
                Manage, schedule, and publish across multiple platforms seamlessly. One place to control your entire content strategy.
              </p>
              <div className="space-y-4">
                <div className="check-mark text-slate-700">
                  <span>Content Calendar: Schedule for optimal timing</span>
                </div>
                <div className="check-mark text-slate-700">
                  <span>Multi-Platform: Publish to Twitter, LinkedIn, and more</span>
                </div>
                <div className="check-mark text-slate-700">
                  <span>Analytics: Track performance and engagement</span>
                </div>
                <div className="check-mark text-slate-700">
                  <span>Brand Consistency: Maintain your voice everywhere</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-20">
            <p className="text-blue-600 font-600 text-sm uppercase tracking-wide mb-4">Pricing</p>
            <h2 className="serif-headline text-5xl text-slate-900 mb-4">
              Simple plans.<br />No surprises.
            </h2>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="pricing-card pricing-light">
              <h3 className="serif-headline text-2xl text-slate-900 mb-2">Starter</h3>
              <p className="text-slate-600 text-sm mb-8">Perfect for testing</p>
              <div className="mb-8">
                <span className="serif-headline text-4xl text-slate-900">Free</span>
              </div>
              <ul className="space-y-3 text-slate-700 text-sm mb-8">
                <li>✓ 5 generations/month</li>
                <li>✓ All content types</li>
                <li>✓ Community support</li>
              </ul>
              <Link
                href="/auth/signup"
                className="btn-secondary w-full py-3 rounded-lg font-600 text-center text-sm transition block"
              >
                Get Started
              </Link>
            </div>

            {/* Professional - Featured */}
            <div className="pricing-card pricing-featured transform md:scale-105 md:relative md:z-10">
              <span className="pricing-badge">MOST POPULAR</span>
              <h3 className="serif-headline text-2xl mb-2">Professional</h3>
              <p className="text-sm mb-8 opacity-95">For serious creators</p>
              <div className="mb-8">
                <span className="serif-headline text-4xl">$49</span>
                <span className="text-sm opacity-90">/mo</span>
              </div>
              <ul className="space-y-3 text-sm mb-8">
                <li>✓ Unlimited generations</li>
                <li>✓ Content calendar</li>
                <li>✓ Priority support</li>
                <li>✓ Analytics dashboard</li>
              </ul>
              <button className="btn-primary w-full py-3 rounded-lg font-600 text-white text-sm transition">
                Start Free Trial
              </button>
            </div>

            {/* Enterprise */}
            <div className="pricing-card pricing-light">
              <h3 className="serif-headline text-2xl text-slate-900 mb-2">Enterprise</h3>
              <p className="text-slate-600 text-sm mb-8">For teams & agencies</p>
              <div className="mb-8">
                <span className="serif-headline text-4xl text-slate-900">Custom</span>
              </div>
              <ul className="space-y-3 text-slate-700 text-sm mb-8">
                <li>✓ Custom limits</li>
                <li>✓ API access</li>
                <li>✓ Dedicated support</li>
                <li>✓ SSO & compliance</li>
              </ul>
              <button className="btn-secondary w-full py-3 rounded-lg font-600 text-sm transition">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-slate-100 text-slate-900 border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="serif-headline text-5xl mb-6">
            Your content,<br />Supercharged.
          </h2>
          <p className="text-slate-600 text-lg mb-10 max-w-2xl mx-auto">
            Stop writing in circles. Start creating content that matters.
          </p>
          <Link
            href="/auth/signup"
            className="btn-primary inline-block px-10 py-4 rounded-lg font-600 text-lg"
          >
            Try for Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 text-slate-700 py-16 px-6 border-t border-slate-200">
        <style>{`
          .footer-column h3 {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 1.25rem;
            font-size: 0.95rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .footer-column a {
            display: block;
            color: #475569;
            font-size: 0.95rem;
            margin-bottom: 0.875rem;
            transition: color 0.2s;
            text-decoration: none;
          }

          .footer-column a:hover {
            color: #1e293b;
          }
        `}</style>

        <div className="max-w-6xl mx-auto">
          {/* Main Footer */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-12">
            {/* Logo */}
            <div>
              <div className="serif-headline text-2xl text-slate-900">ContentFlow</div>
            </div>

            {/* Resources */}
            <div className="footer-column">
              <h3>Resources</h3>
              <a href="#">Mobile</a>
            </div>

            {/* Support */}
            <div className="footer-column">
              <h3>Support</h3>
              <a href="#">Help Center</a>
              <a href="#">Contact Us</a>
            </div>

            {/* Legal */}
            <div className="footer-column">
              <h3>Legal</h3>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-slate-300 pt-8">
            <p className="text-slate-600 text-sm">© 2026 ContentFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
