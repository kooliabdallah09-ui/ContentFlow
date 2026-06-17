'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

interface ComingSoonProps {
  feature: string                 // "Content Calendar", "Blog Post Writer", etc.
  description?: string            // 1-2 sentence pitch for what's coming
  eta?: string                    // "Q1", "early 2026", "next month" — optional
  alternative?: {                 // "Try this instead" pointer
    label: string
    href: string
  }
}

export default function ComingSoon({ feature, description, eta, alternative }: ComingSoonProps) {
  return (
    <main style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px',
    }}>
      <div style={{
        maxWidth: '520px', width: '100%',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '40px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          width: '56px', height: '56px',
          margin: '0 auto 20px',
          borderRadius: '16px',
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={28} />
        </div>

        <p style={{
          margin: '0 0 8px', fontSize: '11px',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'var(--accent)', fontWeight: 700,
        }}>
          Coming Soon{eta ? ` · ${eta}` : ''}
        </p>

        <h1 style={{
          margin: '0 0 12px', fontSize: '26px',
          fontWeight: 700, color: 'var(--ink)',
          fontFamily: 'var(--font-serif)',
        }}>
          {feature}
        </h1>

        {description && (
          <p style={{
            margin: '0 0 28px', fontSize: '14px',
            color: 'var(--ink-dim)', lineHeight: 1.6,
          }}>
            {description}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alternative && (
            <Link
              href={alternative.href}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '12px 20px',
                background: 'var(--accent)', color: 'var(--accent-ink)',
                borderRadius: 'var(--r-sm)', textDecoration: 'none',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              {alternative.label}
              <ArrowRight size={15} />
            </Link>
          )}

          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 20px',
              color: 'var(--ink-dim)', textDecoration: 'none',
              fontSize: '13px',
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
