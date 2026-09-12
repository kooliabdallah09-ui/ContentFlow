import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type CompetitorKey = 'higgsfield' | 'arcads' | 'heygen' | 'runway'

interface FeatureRow {
  feature: string
  contentflow: string | boolean
  competitor: string | boolean
}

interface CompetitorData {
  name: string
  tagline: string
  metaDescription: string
  summary: string
  whereTheyWin: string
  whereWeWin: string
  verdict: string
  pricing: { contentflow: string; competitor: string }
  features: FeatureRow[]
}

const COMPETITORS: Record<CompetitorKey, CompetitorData> = {
  higgsfield: {
    name: 'Higgsfield',
    tagline: 'ContentFlow vs Higgsfield — different tools for different people',
    metaDescription: 'ContentFlow vs Higgsfield: Higgsfield is cinema-grade for creative teams. ContentFlow is built for e-commerce brand owners who ship 20+ ad variants a week.',
    summary: 'Higgsfield is a cinema-grade AI creative suite — 30 million users, $700M ARR, 390 of the Fortune 500 as customers. Beautiful camera controls, motion transfer, agentic content generation. It\'s an incredible tool. It\'s just not built for a e-commerce brand owner who needs to ship 20 ad variants a week under $50/month.',
    whereTheyWin: 'If you\'re a filmmaker, a creative agency, or a Fortune 500 marketing team producing high-end brand films: Higgsfield is the reference. 50+ integrated models, cinematic camera controls no one else has, and an enterprise-grade surface. Genuinely great tool.',
    whereWeWin: 'If you\'re a small e-commerce brand owner, Higgsfield fights you three ways. Their credits expire (ours roll over). Their sweet spot is one polished clip, not batch-testing 10 hooks (we\'re built for weekly velocity). And their outputs skew cinematic, not UGC — TikTok users can spot Higgsfield-style motion instantly. ContentFlow is deliberately built for brand owners who ship every week, test every hook, and need ads that pass platform review.',
    verdict: 'These are two different tools for two different people. Higgsfield: cinematic content for creative teams with budget. ContentFlow: review-safe UGC ads for e-commerce brand owners who ship every week. Neither is worse — they\'re solving different problems.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/mo · credits never expire', competitor: '$19 → $59 → $129/mo · credits expire at cycle end' },
    features: [
      { feature: 'Built for one-person e-com stores', contentflow: true, competitor: false },
      { feature: 'Credits never expire', contentflow: true, competitor: false },
      { feature: 'Batch generation (20+ ad variants)', contentflow: true, competitor: false },
      { feature: 'URL → finished UGC ad workflow', contentflow: true, competitor: false },
      { feature: 'Product Studio (phone photo → editorial)', contentflow: true, competitor: false },
      { feature: 'One wallet, no external editor needed', contentflow: true, competitor: false },
      { feature: 'Number of AI video models', contentflow: 'Seedance 2.0 / 2.5 / Mini', competitor: '50+ models' },
      { feature: 'Cinematic camera controls', contentflow: false, competitor: true },
      { feature: 'Mobile app', contentflow: false, competitor: true },
      { feature: 'Free tier', contentflow: '30 credits', competitor: 'Limited (watermarked)' },
    ],
  },
  arcads: {
    name: 'Arcads',
    tagline: 'ContentFlow vs Arcads — cheaper, complete, and non-expiring credits',
    metaDescription: 'ContentFlow vs Arcads: Arcads is UGC-only and starts at $110/mo. ContentFlow is $19-49/mo, includes product studio, and credits never expire.',
    summary: 'Arcads is a UGC-first AI ad tool — $15M ARR, 6,000 customers, 1,000+ motion-capture actors, and best-in-class lip-sync realism. If your only job is talking-head ads and you have $110-$500/month, Arcads delivers. For everyone else, the math gets hard fast.',
    whereTheyWin: 'Arcads wins on raw talking-head realism. Their motion-capture actors are more lifelike than most generated ones, and their emotion controls are excellent. If UGC talking-head is your one job and budget is not a constraint, they\'re a strong pick.',
    whereWeWin: 'Arcads starts at $110/mo for talking actors. You still need an external editor (they gate their editor behind a $80 add-on), a product photo tool, a script generator, and a caption tool — so you end up in the 4-tool stack anyway. ContentFlow is $19-$49/mo, includes Product Studio for phone-photo-to-editorial shots, includes the editor, includes captions + voice + carousels + brand kit, and credits never expire. Reviews of Arcads flag surprise billing, ghosted refunds, and lip-sync drift — we made non-scandal billing a positioning wedge.',
    verdict: 'Arcads is a premium UGC-only tool for performance marketers spending $100+/mo on one format. ContentFlow is the complete stack for store operators at 20-40% of the price.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/mo · credits never expire', competitor: '$29 (no actors) → $110 → $220 → $500+/mo · credits expire' },
    features: [
      { feature: 'Credits never expire', contentflow: true, competitor: false },
      { feature: 'Editor included (no add-on)', contentflow: true, competitor: false },
      { feature: 'Product Studio (phone photo → editorial)', contentflow: true, competitor: false },
      { feature: 'Complete stack (voice, captions, carousel)', contentflow: true, competitor: false },
      { feature: 'Batch generation (20+ variants)', contentflow: true, competitor: true },
      { feature: 'URL → finished ad', contentflow: true, competitor: false },
      { feature: '30+ language voice output', contentflow: true, competitor: true },
      { feature: 'Actor realism', contentflow: 'Human-passing', competitor: 'Motion-capture (top)' },
      { feature: 'Free tier', contentflow: '30 credits', competitor: false },
      { feature: 'Starting price', contentflow: '$19/mo', competitor: '$110/mo (for talking actors)' },
    ],
  },
  heygen: {
    name: 'HeyGen',
    tagline: 'ContentFlow vs HeyGen — different jobs',
    metaDescription: 'ContentFlow vs HeyGen: HeyGen is enterprise avatar video for training & localization. ContentFlow is UGC ads for one-person e-com stores.',
    summary: 'HeyGen is the enterprise leader for AI avatar video — $200M ARR, 30M users, 85% of Fortune 100. Studio-quality digital twins, 175+ language translation, SOC2, SSO. If you\'re making training videos or localizing spokesperson content across languages, HeyGen is the reference.',
    whereTheyWin: 'HeyGen wins on studio-quality custom avatars, best-in-class translation (175+ languages), and enterprise security. If you\'re running L&D, sales enablement, or need to dub product videos across 20 markets, HeyGen is purpose-built for you.',
    whereWeWin: 'HeyGen\'s outputs read as "corporate presenter" — the wrong signal for UGC ads that need to feel like a real person filmed on their phone. Their per-minute credit math punishes iteration (bad for testing 10 hooks a week). No product URL workflow, no Product Studio, no store-native features. ContentFlow is built for the opposite person: a small e-commerce brand owner who needs review-safe UGC ads that convert, not enterprise polish.',
    verdict: 'HeyGen for enterprise avatars, translation, and training. ContentFlow for one-person e-com stores shipping ad variants every week. Different jobs entirely.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/mo · credits never expire', competitor: 'Free → $29 → $99 → $149/mo + Enterprise' },
    features: [
      { feature: 'Built for UGC ads (not corporate)', contentflow: true, competitor: false },
      { feature: 'Product URL → finished ad', contentflow: true, competitor: false },
      { feature: 'Product Studio (photos)', contentflow: true, competitor: false },
      { feature: 'Credits never expire', contentflow: true, competitor: false },
      { feature: 'Batch generation for ad testing', contentflow: true, competitor: false },
      { feature: 'Video translation (175+ langs)', contentflow: false, competitor: true },
      { feature: 'Enterprise SOC2 / SSO / RBAC', contentflow: false, competitor: true },
      { feature: 'Studio-quality digital twin', contentflow: false, competitor: true },
      { feature: '30+ language voice output', contentflow: true, competitor: true },
      { feature: 'Free tier', contentflow: '30 credits', competitor: '3 videos (watermarked)' },
    ],
  },
  runway: {
    name: 'Runway',
    tagline: 'ContentFlow vs Runway — creative sandbox vs. ad engine',
    metaDescription: 'ContentFlow vs Runway: Runway is a filmmaker\'s tool. ContentFlow is a UGC ad engine for one-person e-com stores.',
    summary: 'Runway is the reference AI video tool for filmmakers and creative professionals — $300M ARR, $5.3B valuation. Gen-4, Act-Two motion capture, cinematic camera control, pro NLE integrations. If you\'re making short films, brand narrative, or fine-art AI video, Runway is unmatched.',
    whereTheyWin: 'Runway wins on creative control, motion coherence, and cinematic quality. If you\'re a video artist, a director, or a brand producing story-driven content and you have the editing skills to finish a piece, Runway is the tool of choice.',
    whereWeWin: 'Runway is a sandbox — it hands you Gen-4 and expects you to compose the final ad yourself. That\'s wrong for a solo store operator testing 20 hooks a week. Runway has no product URL workflow, no AI influencer library, no Product Studio, no script generator, no caption automation, no store-native features. ContentFlow takes a product URL and returns a finished, captioned, voice-over UGC ad in 60 seconds — no creative skill required.',
    verdict: 'Runway for filmmakers with creative skill and time. ContentFlow for solo store operators shipping ad variants every week. Runway makes art. We make ads.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/mo · credits never expire', competitor: '$12 → $28 → $76/mo · credits partially roll over' },
    features: [
      { feature: 'URL → finished UGC ad in 60s', contentflow: true, competitor: false },
      { feature: 'No creative skill required', contentflow: true, competitor: false },
      { feature: 'Product Studio (phone photo → editorial)', contentflow: true, competitor: false },
      { feature: 'Batch ad testing workflow', contentflow: true, competitor: false },
      { feature: 'Credits never expire', contentflow: true, competitor: 'Partial' },
      { feature: 'Complete stack (captions, voice, carousels)', contentflow: true, competitor: false },
      { feature: 'Creative / cinematic control', contentflow: 'Standard', competitor: 'Best-in-class' },
      { feature: 'Motion coherence / camera control', contentflow: 'Standard', competitor: 'Best-in-class' },
      { feature: 'Free tier', contentflow: '30 credits', competitor: 'Limited credits' },
      { feature: 'Time to finished ad', contentflow: '~60 seconds', competitor: 'Hours (requires editing)' },
    ],
  },
}

export async function generateStaticParams() {
  return (Object.keys(COMPETITORS) as CompetitorKey[]).map(c => ({ competitor: c }))
}

export async function generateMetadata({ params }: { params: Promise<{ competitor: string }> }): Promise<Metadata> {
  const { competitor } = await params
  const data = COMPETITORS[competitor as CompetitorKey]
  if (!data) return {}
  return {
    title: `${data.tagline} — ContentFlow`,
    description: data.metaDescription,
  }
}

function Check() {
  return <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 16 }}>✓</span>
}
function Cross() {
  return <span style={{ color: '#e5534b', fontWeight: 700, fontSize: 16 }}>✗</span>
}

export default async function VsPage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor } = await params
  const data = COMPETITORS[competitor as CompetitorKey]
  if (!data) notFound()

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px 120px', color: 'var(--ink)' }}>
      <div style={{ marginBottom: 40 }}>
        <Link href="/vs" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← All comparisons
        </Link>
      </div>

      {/* Hero */}
      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 16px' }}>
        Content<em>flow</em> vs {data.name}
      </h1>
      <p style={{ fontSize: 16, color: 'var(--ink-dim)', margin: '0 0 48px', lineHeight: 1.7, maxWidth: 640 }}>
        {data.summary}
      </p>

      {/* Feature table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 56 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feature</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>ContentFlow</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>{data.name}</span>
        </div>
        {data.features.map((row, i) => (
          <div key={row.feature} style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 140px', padding: '13px 20px', gap: 8, alignItems: 'center',
            borderBottom: i < data.features.length - 1 ? '1px solid var(--border-soft)' : undefined,
            background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
          }}>
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>{row.feature}</span>
            <span style={{ textAlign: 'center', fontSize: 13 }}>
              {typeof row.contentflow === 'boolean'
                ? (row.contentflow ? <Check /> : <Cross />)
                : <span style={{ color: 'var(--ink-dim)' }}>{row.contentflow}</span>}
            </span>
            <span style={{ textAlign: 'center', fontSize: 13 }}>
              {typeof row.competitor === 'boolean'
                ? (row.competitor ? <Check /> : <Cross />)
                : <span style={{ color: 'var(--ink-dim)' }}>{row.competitor}</span>}
            </span>
          </div>
        ))}
        {/* Pricing row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', padding: '13px 20px', gap: 8, alignItems: 'center', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Pricing</span>
          <span style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-dim)' }}>{data.pricing.contentflow}</span>
          <span style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-dim)' }}>{data.pricing.competitor}</span>
        </div>
      </div>

      {/* Prose */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginBottom: 56 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 26, margin: '0 0 10px' }}>Where {data.name} wins</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--ink-dim)', margin: 0 }}>{data.whereTheyWin}</p>
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 26, margin: '0 0 10px' }}>Where ContentFlow wins</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--ink-dim)', margin: 0 }}>{data.whereWeWin}</p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 22, margin: '0 0 8px' }}>The verdict</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--ink-dim)', margin: 0 }}>{data.verdict}</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 32, margin: '0 0 10px' }}>
          Try Content<em>flow</em> free
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-dim)', margin: '0 0 28px' }}>30 credits at signup. No credit card required.</p>
        <Link href="/auth/signup" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 11, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
          Get started free
        </Link>
      </div>

      {/* Other comparisons */}
      <div style={{ marginTop: 56, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '0 0 16px' }}>More comparisons</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(Object.keys(COMPETITORS) as CompetitorKey[])
            .filter(k => k !== competitor)
            .map(k => (
              <Link key={k} href={`/vs/${k}`} style={{ fontSize: 13, color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', textDecoration: 'none' }}>
                vs {COMPETITORS[k].name}
              </Link>
            ))}
        </div>
      </div>
    </main>
  )
}
