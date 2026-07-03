import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — ContentFlow',
  description: 'ContentFlow Privacy Policy — how we collect, use, and protect your data.',
}

const EFFECTIVE_DATE = 'June 24, 2026'
const CONTACT_EMAIL = 'contentflow.web@gmail.com'
const COMPANY_NAME = 'ContentFlow'
const APP_URL = 'https://contentflow-web.com'

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Back to ContentFlow
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '0 0 48px', fontFamily: 'var(--font-mono)' }}>
        Effective {EFFECTIVE_DATE}
      </p>

      <Section title="1. Introduction">
        <p>
          {COMPANY_NAME} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the {COMPANY_NAME} platform
          accessible at <a href={APP_URL} style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>{APP_URL}</a> (the
          &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your
          information when you use our Service.
        </p>
        <p>
          By using the Service, you agree to the collection and use of information in accordance with this policy.
          If you do not agree, please do not use the Service.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p>We collect the following categories of information:</p>

        <h3 style={h3}>Account information</h3>
        <ul>
          <li>Email address and display name provided at signup</li>
          <li>Password (stored as a hashed credential — we never see your plain-text password)</li>
          <li>Profile metadata such as company name, brand description, and industry</li>
        </ul>

        <h3 style={h3}>Content you create</h3>
        <ul>
          <li>Prompts, scripts, and text inputs you submit to generate content</li>
          <li>Product images and screen recordings you upload</li>
          <li>AI-generated videos, images, audio, and social copy produced on your behalf</li>
          <li>Brand settings: logo, colors, tone of voice, target audience</li>
        </ul>

        <h3 style={h3}>Integration credentials</h3>
        <p>
          When you connect a third-party platform (YouTube, TikTok, Instagram, Facebook, Google Drive), we store
          OAuth access tokens and refresh tokens to publish content on your behalf. We do not store your passwords
          for those platforms.
        </p>

        <h3 style={h3}>Usage and technical data</h3>
        <ul>
          <li>Pages visited, features used, and actions taken within the Service</li>
          <li>IP address, browser type, device type, and operating system</li>
          <li>Error logs and performance metrics</li>
          <li>Credit usage history (which content types you generate and their cost)</li>
        </ul>

        <h3 style={h3}>Payment information</h3>
        <p>
          Billing is handled by Stripe. We do not store your full card number, CVV, or bank details. Stripe
          provides us with a payment token and basic billing information (last 4 digits, expiry, billing country).
          Stripe&apos;s privacy policy applies to payment data:{' '}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>stripe.com/privacy</a>.
        </p>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, operate, and maintain the Service</li>
          <li>Generate AI content in response to your inputs using third-party AI models</li>
          <li>Publish content to connected platforms (YouTube, TikTok, Instagram, Facebook) when you request it</li>
          <li>Manage your subscription, credits, and billing</li>
          <li>Send transactional emails (account verification, receipts, usage alerts)</li>
          <li>Respond to support requests and troubleshoot issues</li>
          <li>Analyze aggregate usage patterns to improve the Service</li>
          <li>Detect and prevent fraud, abuse, or violations of our Terms of Service</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>
          We do not sell your personal data to third parties. We do not use your content to train AI models
          without your explicit consent.
        </p>
      </Section>

      <Section title="4. Third-Party Services and Integrations">
        <p>
          The Service integrates with the following third-party services. Each has its own privacy policy that
          governs their data practices:
        </p>

        <h3 style={h3}>AI generation providers</h3>
        <p>
          We use third-party AI infrastructure providers to generate video, image, audio, and text content on
          your behalf. When you generate content, your inputs (prompts, uploaded images, and scripts) are
          transmitted to these providers solely to produce the requested output. We do not authorize them to use
          your inputs for any other purpose. Their respective data processing and retention policies apply to
          data sent to their systems.
        </p>

        <h3 style={h3}>Social platform integrations</h3>
        <ul>
          <li><strong>YouTube (Google)</strong> — OAuth 2.0 token used to upload and schedule videos</li>
          <li><strong>TikTok</strong> — OAuth token used to publish videos via the TikTok Content Posting API</li>
          <li><strong>Instagram / Facebook (Meta)</strong> — OAuth token used to post to Instagram and Facebook Pages via the Meta Graph API</li>
          <li><strong>Google Drive</strong> — OAuth token used to save generated files to your Drive</li>
        </ul>
        <p>
          We only request the minimum scopes necessary to publish content on your behalf. We do not read your
          followers, messages, or content history on these platforms beyond what is required to confirm a
          successful post.
        </p>

        <h3 style={h3}>Infrastructure</h3>
        <ul>
          <li><strong>Supabase</strong> — database and authentication hosting (data stored in the EU/US)</li>
          <li><strong>Vercel</strong> — application hosting and edge delivery</li>
          <li><strong>Stripe</strong> — payment processing</li>
        </ul>
      </Section>

      <Section title="5. Data Retention">
        <p>We retain your data for as long as your account is active. Specifically:</p>
        <ul>
          <li>
            <strong>Account data</strong> — retained until you delete your account. After deletion, your personal
            information is removed within 30 days, except where we are required by law to retain it longer.
          </li>
          <li>
            <strong>Generated content</strong> — stored in your library until you delete it or close your
            account.
          </li>
          <li>
            <strong>OAuth tokens</strong> — retained until you disconnect the integration or delete your account.
            Revoking access in the third-party platform also invalidates the token on our end.
          </li>
          <li>
            <strong>Billing records</strong> — retained for 7 years to comply with financial regulations.
          </li>
          <li>
            <strong>Usage logs</strong> — retained for up to 90 days for debugging and security purposes.
          </li>
        </ul>
      </Section>

      <Section title="6. Your Rights">
        <p>
          Depending on your jurisdiction, you may have the following rights regarding your personal data:
        </p>
        <ul>
          <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
          <li><strong>Correction</strong> — request that inaccurate or incomplete data be corrected</li>
          <li><strong>Deletion</strong> — request deletion of your account and associated personal data</li>
          <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
          <li><strong>Objection / Restriction</strong> — object to or restrict certain processing activities</li>
          <li><strong>Withdraw consent</strong> — where processing is based on consent, you may withdraw it at any time</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>{CONTACT_EMAIL}</a>.
          We will respond within 30 days. You can also delete your account directly from{' '}
          <Link href="/settings/account" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>Settings → Account</Link>.
        </p>
        <p>
          If you are in the European Economic Area (EEA) or UK, you have the right to lodge a complaint with your
          local data protection authority.
        </p>
      </Section>

      <Section title="7. Cookies and Tracking">
        <p>
          We use session cookies and local storage to keep you signed in and remember your preferences (such as
          dark mode). We do not use advertising cookies or cross-site tracking pixels.
        </p>
        <p>
          Third-party services embedded in the Service (Stripe, Supabase) may set their own cookies in
          accordance with their policies.
        </p>
        <p>
          You can disable cookies in your browser settings, but doing so may prevent the Service from functioning
          correctly (in particular, you will be signed out on every page load).
        </p>
      </Section>

      <Section title="8. Data Security">
        <p>
          We implement industry-standard security measures to protect your data:
        </p>
        <ul>
          <li>All data is transmitted over HTTPS/TLS</li>
          <li>Passwords are hashed using bcrypt and never stored in plain text</li>
          <li>OAuth tokens are stored encrypted at rest</li>
          <li>Database access is restricted by row-level security policies</li>
          <li>API keys and secrets are stored as environment variables, never in source code</li>
        </ul>
        <p>
          No method of electronic storage or transmission over the internet is 100% secure. We cannot guarantee
          absolute security, but we will notify affected users promptly in the event of a data breach as required
          by applicable law.
        </p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          The Service is not directed to individuals under the age of 18. We do not knowingly collect personal
          information from children. If you believe a child has provided us with personal information, please
          contact us and we will delete it promptly.
        </p>
      </Section>

      <Section title="10. International Data Transfers">
        <p>
          Your information may be transferred to and processed in countries other than your own, including the
          United States. These countries may have data protection laws that differ from those in your country.
          Where required, we rely on Standard Contractual Clauses or other appropriate safeguards to govern these
          transfers.
        </p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material changes by email
          or by a prominent notice within the Service at least 14 days before the change takes effect. Continued
          use of the Service after the effective date constitutes acceptance of the updated policy.
        </p>
        <p>
          The date at the top of this page reflects when the policy was last updated.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          For any questions, concerns, or requests relating to this Privacy Policy, please contact us:
        </p>
        <p>
          <strong>{COMPANY_NAME}</strong><br />
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>{CONTACT_EMAIL}</a>
        </p>
        <p>
          You may also review our{' '}
          <Link href="/terms" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>Terms of Service</Link>.
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

const h3: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  margin: '20px 0 8px',
  color: 'inherit',
}
