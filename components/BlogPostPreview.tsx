'use client'

import { Clock, User, Calendar, Share2, Bookmark } from 'lucide-react'

interface BlogPostPreviewProps {
  headline: string
  metaDescription: string
  content: string
  featuredImage: string
  outline?: string[]
  faqs?: Array<{ question: string; answer: string }>
}

export default function BlogPostPreview({
  headline,
  metaDescription,
  content,
  featuredImage,
  outline,
  faqs,
}: BlogPostPreviewProps) {
  const wordCount = content.split(/\s+/).length
  const readingTime = Math.ceil(wordCount / 200)

  return (
    <article className="max-w-4xl mx-auto bg-white">
      {/* Featured Image */}
      <div className="mb-8 rounded-xl overflow-hidden shadow-lg h-96">
        <img
          src={featuredImage}
          alt={headline}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Article Header */}
      <header className="mb-8 border-b border-slate-200 pb-8">
        <h1 className="text-5xl font-bold text-slate-900 mb-4 leading-tight">
          {headline}
        </h1>
        <p className="text-xl text-slate-600 mb-6">{metaDescription}</p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-6 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>ContentFlow AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{readingTime} min read</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-600">{wordCount.toLocaleString()} words</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-6">
          <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
            <Bookmark className="w-4 h-4" />
            <span className="text-sm font-500">Save</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-500">Share</span>
          </button>
        </div>
      </header>

      {/* Article Outline */}
      {outline && outline.length > 0 && (
        <div className="mb-12 bg-slate-50 p-8 rounded-lg border border-slate-200">
          <h2 className="text-lg font-600 text-slate-900 mb-4">In this article</h2>
          <ul className="space-y-2">
            {outline.map((section, idx) => (
              <li key={idx} className="text-sm text-slate-700">
                <a href={`#section-${idx}`} className="hover:text-blue-600 transition flex items-center gap-2">
                  <span className="text-blue-600 font-600">{idx + 1}.</span>
                  {section}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content */}
      <div className="prose prose-lg max-w-none mb-12 text-slate-700">
        {content.split('\n\n').map((paragraph, idx) => {
          if (paragraph.startsWith('##')) {
            const title = paragraph.replace(/^##\s*/, '')
            return (
              <h2
                key={idx}
                id={`section-${idx}`}
                className="text-3xl font-bold text-slate-900 mt-12 mb-6 scroll-mt-20"
              >
                {title}
              </h2>
            )
          }
          if (paragraph.startsWith('#')) {
            return null
          }
          return (
            <p key={idx} className="text-lg leading-8 text-slate-700 mb-6">
              {paragraph}
            </p>
          )
        })}
      </div>

      {/* FAQs Section */}
      {faqs && faqs.length > 0 && (
        <div className="mt-16 border-t border-slate-200 pt-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, idx) => (
              <details
                key={idx}
                className="group border border-slate-200 rounded-lg p-6 hover:bg-slate-50 transition cursor-pointer"
              >
                <summary className="flex items-start justify-between font-600 text-slate-900 text-lg">
                  {faq.question}
                  <span className="ml-4 text-blue-600 group-open:rotate-180 transition">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-slate-700 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Author Section */}
      <div className="mt-16 pt-12 border-t border-slate-200">
        <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-8 flex gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xl">
            CF
          </div>
          <div>
            <h3 className="font-600 text-slate-900 mb-2">ContentFlow AI</h3>
            <p className="text-sm text-slate-600">
              Powered by advanced AI to generate SEO-optimized, high-converting blog posts in minutes. ContentFlow helps creators focus on strategy while AI handles the writing.
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}
