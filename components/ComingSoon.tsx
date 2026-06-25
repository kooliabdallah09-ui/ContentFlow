'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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
      minHeight: 'calc(100vh - 60px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px',
    }}>
      <div style={{
        maxWidth: 560, width: '100%',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, padding: 44,
        textAlign: 'center',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          width: 56, height: 56,
          margin: '0 auto 18px',
          borderRadius: 16,
          background: 'var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 10,
        }}>
          <img src="/logo-icon.png" alt="ContentFlow" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <p style={{
          margin: '0 0 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11, letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-fade)',
        }}>
          Coming Soon{eta ? ` · ${eta}` : ''}
        </p>

        <h1 style={{
          margin: '0 0 14px',
          fontFamily: 'var(--font-serif)', fontWeight: 400,
          fontSize: 38, lineHeight: 1.1, letterSpacing: '-0.01em',
        }}>
          {feature}
        </h1>

        {description && (
          <p style={{
            margin: '0 0 30px', fontSize: 14.5,
            color: 'var(--ink-dim)', lineHeight: 1.6,
          }}>
            {description}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {alternative && (
            <Link
              href={alternative.href}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '13px 28px',
                background: 'var(--ink)', color: 'var(--on-ink)',
                borderRadius: 11, textDecoration: 'none',
                fontSize: 14, fontWeight: 600,
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
              color: 'var(--ink-mute)', textDecoration: 'none',
              fontSize: 13,
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
