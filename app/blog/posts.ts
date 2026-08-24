// Simple in-repo blog registry. Each post gets a static Next.js route at
// /blog/[slug] rendered from the file at app/blog/[slug]/page.tsx. Add new
// entries here first; the [slug] route imports POSTS to build metadata.

export interface BlogPost {
  slug: string
  title: string
  description: string
  publishedAt: string      // ISO date
  author: string
  readingMinutes: number
  category: string
  excerpt: string          // 1-2 sentence teaser used on the index card
}

export const POSTS: BlogPost[] = [
  {
    slug: 'why-your-ai-ugc-ad-looks-like-an-ai-ugc-ad',
    title: 'Why your AI UGC ad looks like an AI UGC ad — and how to fix it',
    description:
      'The six patterns that make AI-generated UGC scripts feel fake — and the seven angles that actually convert.',
    publishedAt: '2026-08-24',
    author: 'ContentFlow',
    readingMinutes: 7,
    category: 'AI UGC',
    excerpt:
      'You can spot an AI-generated UGC ad in about three seconds. It\'s not the visuals — it\'s the script. Here\'s the exact anatomy of the tell, and what we changed in our own pipeline to fix it.',
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find(p => p.slug === slug)
}
