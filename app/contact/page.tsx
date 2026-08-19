import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact — Contentflow Web',
  description: 'Get in touch with the Contentflow Web team.',
}

const CONTACT_EMAIL = 'contentflow.web@gmail.com'

export default function ContactPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to Contentflow Web
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 24px' }}>
        Contact
      </h1>

      <div style={{ fontSize: 15.5, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <p>
          Fastest way to reach us is email — we reply within one business day:
        </p>
        <a href={`mailto:${CONTACT_EMAIL}`} style={{
          display: 'inline-block', width: 'fit-content',
          padding: '13px 22px', borderRadius: 10,
          background: 'var(--ink)', color: 'var(--on-ink, #fff)',
          fontWeight: 600, fontSize: 14.5, textDecoration: 'none',
        }}>
          {CONTACT_EMAIL}
        </a>
        <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
          <p style={{ margin: '0 0 8px' }}><strong style={{ color: 'var(--ink)' }}>Billing &amp; refunds</strong> — include your account email and the receipt or transaction ID from Dodo Payments&apos; confirmation email. See our <Link href="/refunds" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>Refund Policy</Link>.</p>
          <p style={{ margin: '0 0 8px' }}><strong style={{ color: 'var(--ink)' }}>Bugs &amp; failed generations</strong> — tell us which tool you used and roughly when; we&apos;ll re-run it or return your credits.</p>
          <p style={{ margin: 0 }}><strong style={{ color: 'var(--ink)' }}>Privacy requests</strong> — data access or deletion requests are honored per our <Link href="/privacy" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>Privacy Policy</Link>.</p>
        </div>
      </div>
    </main>
  )
}
