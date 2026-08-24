import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { POSTS, getPost } from '../posts'
import { PostBody } from './post-body'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return POSTS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Not found' }
  return {
    title: `${post.title} — ContentFlow`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 120px', color: 'var(--ink)', lineHeight: 1.75 }}>
      <div style={{ marginBottom: 40 }}>
        <Link href="/blog" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← All posts
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-dim)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 18 }}>
        <span>{post.category}</span>
        <span>·</span>
        <span>{formatDate(post.publishedAt)}</span>
        <span>·</span>
        <span>{post.readingMinutes} min read</span>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.015em', margin: '0 0 40px' }}>
        {post.title}
      </h1>

      <PostBody slug={post.slug} />

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '56px 0 32px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Written by {post.author}</div>
        <Link
          href="/auth/signup"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10,
            background: 'var(--ink)', color: 'var(--on-ink)',
            fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Try ContentFlow free →
        </Link>
      </div>
    </main>
  )
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
