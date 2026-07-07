import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Data Deletion — ContentFlow',
  description: 'Request deletion of your ContentFlow account and associated data.',
}

const CONTACT_EMAIL = 'contentflow.web@gmail.com'

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  let status: string | null = null
  let requestedAt: string | null = null

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('data_deletion_requests')
      .select('status, requested_at')
      .eq('confirmation_code', code)
      .maybeSingle()
    if (data) {
      status = data.status
      requestedAt = data.requested_at
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px', color: 'var(--ink)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 48 }}>
        <Link
          href="/"
          style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
        >
          ← Back to Contentflow Web
        </Link>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
        Data Deletion
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '0 0 48px', fontFamily: 'var(--font-mono)' }}>
        How to remove your data from ContentFlow
      </p>

      {code && (
        <section style={{ marginBottom: 40, padding: 24, border: '1px solid var(--line)', borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Deletion request status</h2>
          {status ? (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 14.5 }}>
                Confirmation code: <code style={{ fontFamily: 'var(--font-mono)' }}>{code}</code>
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 14.5 }}>
                Status: <strong>{status}</strong>
              </p>
              {requestedAt && (
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-dim)' }}>
                  Requested {new Date(requestedAt).toLocaleString()}
                </p>
              )}
              <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-dim)' }}>
                Deletions typically complete within 30 days. We will disconnect all linked accounts immediately and
                remove personal data on our next processing cycle.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14.5 }}>No request found for that confirmation code.</p>
          )}
        </section>
      )}

      <Section title="1. Delete your ContentFlow account">
        <p>
          You can permanently delete your ContentFlow account, brand profile, generated content, and any connected
          social integrations at any time by following these steps:
        </p>
        <ol>
          <li>Sign in at <a href="https://contentflow-web.com" style={{ color: 'var(--ink)' }}>contentflow-web.com</a>.</li>
          <li>Go to <strong>Settings → Account</strong>.</li>
          <li>Click <strong>Delete account</strong> and confirm.</li>
        </ol>
        <p>
          Once confirmed, your account is scheduled for deletion. All personal data, brand information, generated
          videos, images, carousels, scheduled posts, and OAuth tokens for connected platforms (Facebook, Instagram,
          TikTok, YouTube) are permanently removed within 30 days.
        </p>
      </Section>

      <Section title="2. Disconnect only Facebook or Instagram">
        <p>
          If you want to remove ContentFlow&apos;s access to your Facebook Pages or Instagram Business account
          without deleting the whole account:
        </p>
        <ol>
          <li>Sign in and go to <strong>Settings → Integrations</strong>.</li>
          <li>Click <strong>Disconnect</strong> next to Facebook or Instagram.</li>
        </ol>
        <p>
          You can also revoke access directly from Facebook: <a href="https://www.facebook.com/settings?tab=business_tools" style={{ color: 'var(--ink)' }}>
            facebook.com/settings?tab=business_tools
          </a>. Removing ContentFlow there immediately invalidates our access tokens.
        </p>
      </Section>

      <Section title="3. Request deletion by email">
        <p>
          If you cannot sign in, or you accessed ContentFlow only via Facebook Login, email us and we will process
          the deletion manually within 30 days:
        </p>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Data%20Deletion%20Request`} style={{ color: 'var(--ink)' }}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Include the email address or Facebook/Instagram handle associated with your ContentFlow account so we can
          locate and remove your data.
        </p>
      </Section>

      <Section title="4. What gets deleted">
        <ul>
          <li>Account credentials and profile</li>
          <li>Brand profile, product info, uploaded logos</li>
          <li>All generated videos, images, carousels, and social posts</li>
          <li>Scheduled and published post history</li>
          <li>OAuth access tokens for Facebook, Instagram, TikTok, YouTube</li>
          <li>Billing metadata (we retain invoices only where required by tax law)</li>
        </ul>
      </Section>

      <Section title="5. Contact">
        <p>
          Questions about data deletion or privacy? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--ink)' }}>{CONTACT_EMAIL}</a>. See our{' '}
          <Link href="/privacy" style={{ color: 'var(--ink)' }}>Privacy Policy</Link> for the full picture.
        </p>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{title}</h2>
      <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.75 }}>{children}</div>
    </section>
  )
}
