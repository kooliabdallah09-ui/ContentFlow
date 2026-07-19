import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contentflow Web Terms of Service',
  description: 'Contentflow Web Terms of Service',
}

const EFFECTIVE_DATE = 'June 24, 2026'
const CONTACT_EMAIL = 'contentflow.web@gmail.com'
const COMPANY_NAME = 'Contentflow Web'

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to Contentflow Web
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
        Contentflow Web Terms of Service
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '0 0 48px', fontFamily: 'var(--font-mono)' }}>
        Effective {EFFECTIVE_DATE}
      </p>

      <Section title="1. Agreement to these Terms">
        <p>
          By accessing or using {COMPANY_NAME} (&quot;the Service&quot;), you agree to be bound by these Terms of
          Service (&quot;Terms&quot;). If you disagree with any part of these Terms, you may not access the Service.
        </p>
        <p>
          {COMPANY_NAME} reserves the right to update these Terms at any time. Continued use of the Service after
          changes constitutes acceptance of the new Terms.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          {COMPANY_NAME} is an AI-powered content creation platform that allows users to generate UGC (user-generated
          content) videos, screen demo videos, AI voiceovers, product images, social media copy, blog posts, and email
          copy using third-party AI models and APIs.
        </p>
        <p>
          Generated content is produced using artificial intelligence and may not always meet your expectations. Results
          vary depending on inputs provided.
        </p>
      </Section>

      <Section title="3. Account Registration">
        <p>
          You must create an account to use the Service. You are responsible for maintaining the confidentiality of your
          account credentials and for all activity that occurs under your account. You must be at least 18 years old to
          use the Service.
        </p>
        <p>
          You agree to provide accurate, current, and complete information during registration and to update such
          information to keep it accurate.
        </p>
      </Section>

      <Section title="4. Credits, Subscriptions &amp; Billing">
        <p>
          The Service operates on a credit system. Credits are consumed when generating content. Credit costs vary by
          content type and duration.
        </p>
        <ul>
          <li>
            <strong>Subscriptions:</strong> Monthly and annual subscription plans renew automatically. You may cancel at
            any time via the billing portal; cancellation takes effect at the end of the current billing period. Monthly
            credits do not roll over to the next billing cycle.
          </li>
          <li>
            <strong>Credit Packs:</strong> One-time credit pack purchases do not expire and do not auto-renew. Credits
            from packs roll over and persist until used.
          </li>
          <li>
            <strong>Payments:</strong> Payments are processed by our merchant of record, Paddle.com Market Ltd
            (&quot;Paddle&quot;), which handles checkout, billing, taxes, and payment support.
          </li>
          <li>
            <strong>Refunds:</strong> Refunds are governed by our{' '}
            <Link href="/refunds" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>Refund Policy</Link> — in
            short, unused purchases can be refunded within 14 days; consumed credits cannot.
          </li>
          <li>
            <strong>Free Tier:</strong> Free accounts receive a one-time signup credit bonus subject to usage caps. Free
            credits do not expire but are subject to rate limits.
          </li>
        </ul>
        <p>
          Pricing is subject to change. We will provide at least 30 days&apos; notice before increasing prices for
          existing subscribers.
        </p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Generate content that is illegal, defamatory, harassing, threatening, or fraudulent</li>
          <li>
            Impersonate real individuals without their consent in generated video or audio content (including deepfakes
            of public figures)
          </li>
          <li>Generate sexual content involving minors or non-consensual scenarios</li>
          <li>Violate third-party intellectual property rights</li>
          <li>Circumvent rate limits, abuse the free tier, or attempt to reverse-engineer the platform</li>
          <li>Use AI-generated content to mislead consumers about the authenticity of testimonials or reviews</li>
          <li>
            Violate platform policies of any distribution channel (Meta, TikTok, Google, etc.) on which you publish
            generated content
          </li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate these rules without refund.
        </p>
      </Section>

      <Section title="6. AI-Generated Content — Disclaimers">
        <p>
          {COMPANY_NAME} generates content using third-party AI models (including but not limited to ElevenLabs, Kling,
          Sora, Claude, and Shotstack). We do not guarantee the accuracy, originality, or legality of AI-generated
          output.
        </p>
        <p>
          You are solely responsible for reviewing generated content before publishing or distributing it. You
          acknowledge that AI-generated voices, video, and imagery may not be suitable for all use cases and that
          results may vary.
        </p>
        <p>
          If you use AI-generated content in advertising or marketing, you are responsible for complying with applicable
          advertising disclosure laws and platform-specific policies regarding AI-generated content.
        </p>
      </Section>

      <Section title="7. Intellectual Property &amp; Content Ownership">
        <p>
          <strong>Your content:</strong> You retain ownership of any original content you upload to the Service
          (product photos, screen recordings, scripts, etc.).
        </p>
        <p>
          <strong>Generated content:</strong> Subject to your compliance with these Terms and applicable third-party
          AI provider terms, you own the AI-generated output produced from your inputs. You grant {COMPANY_NAME} a
          limited, non-exclusive license to store and process your content solely to deliver the Service.
        </p>
        <p>
          <strong>Platform IP:</strong> {COMPANY_NAME}&apos;s software, design, brand, and non-user content remain the
          exclusive property of {COMPANY_NAME}.
        </p>
        <p>
          Note: Some AI providers impose their own terms on generated outputs. By using the Service, you agree to
          comply with those providers&apos; terms (available on their respective websites).
        </p>
      </Section>

      <Section title="8. Privacy">
        <p>
          Your use of the Service is also governed by our{' '}
          <Link href="/privacy" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>
            Privacy Policy
          </Link>
          , which is incorporated into these Terms by reference.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, {COMPANY_NAME} and its officers, employees, and contractors shall not
          be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of
          profits, data, or business — arising from your use of the Service.
        </p>
        <p>
          {COMPANY_NAME}&apos;s total liability to you for any claims arising from these Terms shall not exceed the
          amount you paid to {COMPANY_NAME} in the 12 months preceding the claim.
        </p>
      </Section>

      <Section title="10. Disclaimer of Warranties">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without any warranty of any kind,
          express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that generated
          content will meet your specific requirements.
        </p>
      </Section>

      <Section title="11. Termination">
        <p>
          You may close your account at any time. We may suspend or terminate your account at any time for violations
          of these Terms or for any other reason with reasonable notice, except in cases of serious violations where
          immediate termination may apply.
        </p>
        <p>
          On termination, your right to use the Service ceases immediately. Unused credits are non-refundable upon
          voluntary account closure.
        </p>
      </Section>

      <Section title="12. Governing Law">
        <p>
          These Terms are governed by and construed in accordance with the laws of the jurisdiction in which{' '}
          {COMPANY_NAME} operates, without regard to conflict of law principles. Any disputes shall be resolved
          through binding arbitration, except where prohibited by law.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          If you have any questions about these Terms, please contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>
            {CONTACT_EMAIL}
          </a>
          .
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
