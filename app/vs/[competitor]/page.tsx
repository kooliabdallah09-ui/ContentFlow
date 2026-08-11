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
    tagline: 'ContentFlow vs Higgsfield — Which is right for your brand?',
    metaDescription: 'ContentFlow vs Higgsfield: honest comparison of features, pricing, and use cases. See which AI content tool fits e-commerce brands and indie founders best.',
    summary: 'Higgsfield is a multi-model video aggregator with 22 million users. It bundles Kling, Sora, Veo, and Seedance under one subscription and recently added a Marketing Studio with UGC formats. It\'s a powerful video tool. But it stops at video.',
    whereTheyWin: 'Higgsfield wins on raw model variety (50+ models), mobile app quality, and cinematic camera controls. If you\'re a filmmaker or creator who just needs great video generation across many styles, it\'s a strong choice.',
    whereWeWin: 'ContentFlow wins on brand depth. Your AI influencer is tied to your specific brand identity and reusable across every campaign. Your product studio photos feed directly into your video ads, captions, blog posts, and emails — from one profile. Higgsfield users still need separate tools for written content, product photography, and brand consistency.',
    verdict: 'If you need one great video clip, Higgsfield works. If you need a brand\'s entire content stack — video + photos + copy — without stitching together five tools, ContentFlow is built for that.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/month', competitor: '$15 → $49 → $129/month' },
    features: [
      { feature: 'UGC video ads', contentflow: true, competitor: true },
      { feature: 'Custom AI influencers (brand-persistent)', contentflow: true, competitor: false },
      { feature: 'Product Studio (multi-angle shoots)', contentflow: true, competitor: false },
      { feature: 'Written content (blog, email, captions)', contentflow: true, competitor: false },
      { feature: 'Brand profile (feeds all formats)', contentflow: true, competitor: false },
      { feature: 'Free tier', contentflow: '30 credits', competitor: 'Limited' },
      { feature: 'Number of AI video models', contentflow: 'Seedance 2 + Kling v3', competitor: '50+ models' },
      { feature: 'Mobile app', contentflow: false, competitor: true },
      { feature: 'Camera / motion controls', contentflow: 'Standard', competitor: 'Advanced' },
      { feature: 'Google Drive backup', contentflow: true, competitor: false },
    ],
  },
  arcads: {
    name: 'Arcads',
    tagline: 'ContentFlow vs Arcads — Which makes better UGC ads?',
    metaDescription: 'ContentFlow vs Arcads: compare AI UGC ad creation tools. Arcads uses motion-capture actors. ContentFlow builds a persistent AI influencer tied to your brand.',
    summary: 'Arcads is widely considered the most realistic AI UGC generator, using motion-capture technology with real consenting actors. Its lip-sync and micro-expressions are best-in-class for talking-head ads. It\'s a specialist tool that does one thing very well.',
    whereTheyWin: 'Arcads wins on raw talking-head realism. The motion-capture actors produce more human-looking results than generated influencers. If photorealistic human performance in a single format is your only need, Arcads delivers.',
    whereWeWin: 'ContentFlow wins on brand ownership and breadth. With Arcads, you rent their actor library — the faces aren\'t yours and they\'re shared across all Arcads customers. With ContentFlow, your AI influencer is exclusively yours, reusable forever, and tied to your brand identity. You also get product photos, social captions, blog posts, and email copy from the same platform.',
    verdict: 'Arcads is a great UGC-only tool if realism is everything and you\'re fine renting shared actors. ContentFlow is the better choice if you want brand-owned content and a full marketing stack, not just one video format.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/month', competitor: 'From ~$49/month (actor-based credits)' },
    features: [
      { feature: 'UGC talking-head ads', contentflow: true, competitor: true },
      { feature: 'Brand-owned AI influencer', contentflow: true, competitor: false },
      { feature: 'Exclusive identity (not shared)', contentflow: true, competitor: false },
      { feature: 'Product Studio', contentflow: true, competitor: false },
      { feature: 'Written content (blog, email, captions)', contentflow: true, competitor: false },
      { feature: 'Free tier', contentflow: '30 credits', competitor: false },
      { feature: 'Actor realism', contentflow: 'AI-generated', competitor: 'Motion-capture (more realistic)' },
      { feature: 'Motion-broll & cinematic formats', contentflow: true, competitor: false },
      { feature: 'Google Drive backup', contentflow: true, competitor: false },
      { feature: 'Brand profile (feeds all formats)', contentflow: true, competitor: false },
    ],
  },
  heygen: {
    name: 'HeyGen',
    tagline: 'ContentFlow vs HeyGen — AI video for brands compared',
    metaDescription: 'ContentFlow vs HeyGen: compare AI avatar video tools. HeyGen focuses on presentations and training videos. ContentFlow is built for product ads and brand content.',
    summary: 'HeyGen is a polished AI avatar platform primarily used for business presentations, training videos, and spokesperson content. It has strong lip-sync quality and supports video translation. It\'s trusted by enterprise teams for internal and marketing communications.',
    whereTheyWin: 'HeyGen wins on avatar polish, video translation (50+ languages), and enterprise workflow features. If you need professional-looking spokesperson videos or need to localize content across languages, HeyGen is purpose-built for that.',
    whereWeWin: 'ContentFlow wins on product-first content creation. HeyGen has no product studio, no product photo generation, and no written content tools. It\'s a talking-head video tool, not a brand content system. ContentFlow connects your product photos to your AI influencer to your captions, blog, and email in one workflow.',
    verdict: 'HeyGen is excellent for enterprise communications and localization. ContentFlow is built for DTC brands and e-commerce sellers who need a complete content stack, not just avatar videos.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/month', competitor: 'Free → $29 → $89/month' },
    features: [
      { feature: 'AI talking-head video', contentflow: true, competitor: true },
      { feature: 'Brand-owned AI influencer', contentflow: true, competitor: 'Stock avatars' },
      { feature: 'Product Studio (photos)', contentflow: true, competitor: false },
      { feature: 'UGC ad formats (28 formats)', contentflow: true, competitor: false },
      { feature: 'Written content (blog, email, captions)', contentflow: true, competitor: false },
      { feature: 'Video translation', contentflow: false, competitor: true },
      { feature: 'Free tier', contentflow: '30 credits', competitor: 'Limited' },
      { feature: 'Brand profile', contentflow: true, competitor: false },
      { feature: 'Product-to-video workflow', contentflow: true, competitor: false },
      { feature: 'Google Drive backup', contentflow: true, competitor: false },
    ],
  },
  runway: {
    name: 'Runway',
    tagline: 'ContentFlow vs Runway — Creative AI video compared',
    metaDescription: 'ContentFlow vs Runway: Runway is a creative filmmaker\'s tool. ContentFlow is a brand marketing system. See which fits your workflow.',
    summary: 'Runway is a creative AI video platform used by filmmakers, directors, and video editors. Its Gen-3 and Gen-4 models produce cinematic, stylized video from text and images. It\'s a professional creative tool with deep editing capabilities and a strong community of artists.',
    whereTheyWin: 'Runway wins on creative control, video quality for cinematic work, and advanced editing features. If you\'re producing narrative content, short films, or need fine-grained artistic control over video outputs, Runway is the industry reference.',
    whereWeWin: 'ContentFlow wins on marketing efficiency. Runway has no product studio, no AI influencers, no brand profile, and no written content tools. It requires significant creative skill to produce a finished ad. ContentFlow takes a product photo and produces a finished UGC ad with script, voiceover, captions, and B-roll in 2 minutes — no creative skill required.',
    verdict: 'Runway is for creative professionals making cinematic content. ContentFlow is for brand owners who need finished marketing assets fast, not a creative sandbox.',
    pricing: { contentflow: 'Free → $19 → $49 → $149/month', competitor: 'Free → $15 → $35 → $95/month' },
    features: [
      { feature: 'AI video generation', contentflow: true, competitor: true },
      { feature: 'UGC ad workflow (script → voice → captions)', contentflow: true, competitor: false },
      { feature: 'Brand-owned AI influencer', contentflow: true, competitor: false },
      { feature: 'Product Studio', contentflow: true, competitor: false },
      { feature: 'Written content (blog, email, captions)', contentflow: true, competitor: false },
      { feature: 'Cinematic creative control', contentflow: 'Standard', competitor: 'Advanced' },
      { feature: 'Free tier', contentflow: '30 credits', competitor: 'Limited credits' },
      { feature: 'Brand profile', contentflow: true, competitor: false },
      { feature: 'Time to finished ad', contentflow: '~2 minutes', competitor: 'Hours (requires editing)' },
      { feature: 'No creative skill required', contentflow: true, competitor: false },
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
