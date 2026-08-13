import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://contentflow-web.com'
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/landing`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/help`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/vs/higgsfield`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/vs/arcads`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/vs/heygen`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/vs/runway`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/refunds`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  return staticPages
}
