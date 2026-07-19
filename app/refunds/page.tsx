import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contentflow Web Refund Policy',
  description: 'When and how Contentflow Web purchases can be refunded.',
}

const EFFECTIVE_DATE = 'July 19, 2026'
const CONTACT_EMAIL = 'contentflow.web@gmail.com'
const COMPANY_NAME = 'Contentflow Web'

export default function RefundsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to Contentflow Web
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
        Refund Policy
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '0 0 48px', fontFamily: 'var(--font-mono)' }}>
        Effective {EFFECTIVE_DATE}
      </p>

      <Section title="1. Overview">
        <p>
          Payments for {COMPANY_NAME} are processed by our merchant of record, Paddle.com Market Ltd
          (&quot;Paddle&quot;). Because AI generations incur real compute costs the moment they run, refunds are tied to
          whether purchased credits have been used.
        </p>
      </Section>

      <Section title="2. Subscriptions">
        <ul>
          <li>
            <strong>First purchase, unused:</strong> if you subscribe and have used none of the plan&apos;s credits, you may
            request a full refund within 14 days of the charge.
          </li>
          <li>
            <strong>Partially used:</strong> once credits from a billing period have been spent, that period&apos;s charge is
            non-refundable, but you can cancel any time to stop future charges — you keep access until the period ends.
          </li>
          <li>
            <strong>Renewals:</strong> if a renewal charges you and you have used none of the renewed credits, contact us
            within 14 days and we will refund that renewal.
          </li>
        </ul>
      </Section>

      <Section title="3. Credit Packs">
        <p>
          One-time credit packs are refundable within 14 days of purchase provided the pack&apos;s credits are unused.
          Once any pack credits have been spent, the purchase is non-refundable.
        </p>
      </Section>

      <Section title="4. Failed or Faulty Generations">
        <p>
          If a generation fails, credits are not charged, or are automatically returned. If you believe you were charged
          for output that never arrived or was technically defective (not merely a result you dislike — AI outputs vary
          by nature), contact us with the generation details and we will re-run it or return the credits.
        </p>
      </Section>

      <Section title="5. How to Request a Refund">
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>{CONTACT_EMAIL}</a>{' '}
          from your account email with the receipt or transaction ID. You can also use the receipt link in Paddle&apos;s
          confirmation email. Approved refunds are returned to the original payment method, typically within 5–10
          business days.
        </p>
      </Section>

      <Section title="6. Statutory Rights">
        <p>
          Nothing in this policy limits any non-waivable statutory rights you have in your country of residence,
          including EU/UK consumer withdrawal rights where applicable.
        </p>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  )
}
