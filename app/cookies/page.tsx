import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Cookie Policy — ContentFlow Web',
  description: 'How ContentFlow Web uses cookies.',
}

const EFFECTIVE_DATE = 'July 20, 2026'

export default function CookiesPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to ContentFlow Web
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
        Cookie Policy
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '0 0 48px', fontFamily: 'var(--font-mono)' }}>
        Effective {EFFECTIVE_DATE}
      </p>

      <div style={{ fontSize: 14.5, lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p>
          ContentFlow Web uses a small number of cookies and similar browser-storage technologies. We do not
          sell data or run third-party advertising trackers.
        </p>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Essential cookies</h2>
          <p style={{ margin: 0 }}>
            Used to keep you signed in (Supabase authentication session) and to remember in-app preferences
            like dismissed notices. The Service cannot function without these, so they are always active.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Payment cookies</h2>
          <p style={{ margin: 0 }}>
            During checkout, our merchant of record Dodo Payments sets cookies required for fraud prevention
            and to process your payment securely. See Dodo Payments&apos; own privacy policy for details.
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Managing cookies</h2>
          <p style={{ margin: 0 }}>
            You can clear or block cookies in your browser settings at any time; blocking essential cookies
            will sign you out. Questions:{' '}
            <a href="mailto:contentflow.web@gmail.com" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>contentflow.web@gmail.com</a>.
            See also our <Link href="/privacy" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  )
}
