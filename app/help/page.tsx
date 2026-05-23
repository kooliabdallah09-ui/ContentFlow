'use client'

import { useState } from 'react'
import { HelpCircle, ChevronDown, BookOpen } from 'lucide-react'
import Link from 'next/link'

const faqs = [
  {
    category: 'Getting Started',
    items: [
      {
        question: 'How do I get started with ContentFlow?',
        answer:
          'Start with the Dashboard to see all available generators. Choose the type of content you want to create (Blog, Social, Email, etc.) and fill in your requirements. Your content will be generated instantly!',
      },
      {
        question: 'What is the credit system?',
        answer:
          'ContentFlow uses a credit-based system where each piece of content costs a certain number of credits. Images cost 80 credits, voiceovers cost 150, and videos cost 300. You can monitor your credit balance in the top navigation.',
      },
      {
        question: 'How do I know how many credits I have?',
        answer:
          'Your current credit balance is always visible in the top-right corner of the page. You can also view detailed credit usage in the Analytics section.',
      },
    ],
  },
  {
    category: 'Content Generators',
    items: [
      {
        question: 'What can I generate?',
        answer:
          'ContentFlow supports: Blog Posts, Social Media Posts, Email Sequences, Images (Flux Pro), Voiceovers (ElevenLabs), Videos (HeyGen), and complete UGC Packages that combine multiple media types.',
      },
      {
        question: 'How do I create an image?',
        answer:
          'Go to Image Generator, describe what you want in the prompt field, choose a style (realistic, artistic, cartoon, etc.), select a size, and click Generate. Your images will appear in the preview panel.',
      },
      {
        question: 'Can I generate multiple items at once?',
        answer:
          'Yes! Use the Batch Generator to create multiple pieces of content efficiently. You can generate up to 50 items in a single batch, saving credits and time.',
      },
    ],
  },
  {
    category: 'Library and Management',
    items: [
      {
        question: 'Where do I find all my generated content?',
        answer:
          'All your generated content is stored in the Library. You can search, filter by type, preview, download, and manage your content there.',
      },
      {
        question: 'Can I delete content from my library?',
        answer:
          'Yes, you can delete individual items or use bulk delete to remove multiple items at once. This action cannot be undone, so be careful!',
      },
      {
        question: 'How do I download my content?',
        answer:
          'Each item in your library has a download button. Simply click it to download your generated content in its native format.',
      },
    ],
  },
  {
    category: 'Advanced Features',
    items: [
      {
        question: 'What is the Batch Generator?',
        answer:
          'The Batch Generator lets you submit multiple generation requests at once. It\'s perfect for creating dozens of variations efficiently. You can monitor progress and see results as they complete.',
      },
      {
        question: 'How do I schedule content generation?',
        answer:
          'Use the Scheduler to set up recurring or one-time content generation jobs. Perfect for automating your content pipeline - set it and forget it!',
      },
      {
        question: 'What is the UGC Package generator?',
        answer:
          'The UGC Package generator creates complete, coordinated packages with images, voiceovers, and videos all optimized for your product. Just provide product info and select your package type!',
      },
    ],
  },
  {
    category: 'Settings and Preferences',
    items: [
      {
        question: 'How do I manage my account?',
        answer:
          'Go to Settings to update your profile, manage notification preferences, enable/disable auto-save, and access security options.',
      },
      {
        question: 'What is auto-save and how does it work?',
        answer:
          'Auto-save automatically saves your form inputs to your browser. If you leave a page without submitting, your changes are preserved and restored when you return.',
      },
      {
        question: 'Can I disable notifications?',
        answer:
          'Yes, go to Settings and toggle the Notifications option. You can control which types of updates you receive.',
      },
    ],
  },
  {
    category: 'Troubleshooting',
    items: [
      {
        question: 'What should I do if generation fails?',
        answer:
          'First, check your credit balance and internet connection. If the error persists, try refreshing the page or clearing your browser cache. Error messages will provide specific details about what went wrong.',
      },
      {
        question: 'Why is the page loading slowly?',
        answer:
          'This could be due to network speed, browser performance, or API load times. Try refreshing the page, closing other tabs, or trying again in a few minutes.',
      },
      {
        question: 'I forgot my password. What do I do?',
        answer:
          'On the login page, click "Forgot password?" to reset your password. Follow the email instructions to create a new password.',
      },
    ],
  },
]

export default function HelpPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-black">Help & Documentation</h1>
          </div>
          <p className="text-white/60 text-lg">
            Everything you need to know about ContentFlow
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard"
            className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/50 transition-colors"
          >
            <h3 className="font-semibold mb-2">Dashboard</h3>
            <p className="text-sm text-white/60">
              Start creating content with our generators
            </p>
          </Link>

          <Link
            href="/library"
            className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/50 transition-colors"
          >
            <h3 className="font-semibold mb-2">Library</h3>
            <p className="text-sm text-white/60">
              View and manage all your generated content
            </p>
          </Link>

          <Link
            href="/analytics"
            className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/50 transition-colors"
          >
            <h3 className="font-semibold mb-2">Analytics</h3>
            <p className="text-sm text-white/60">
              Track your usage and credit consumption
            </p>
          </Link>
        </div>

        {/* FAQ */}
        <div className="space-y-6">
          {faqs.map((category) => (
            <div key={category.category}>
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === category.category
                      ? null
                      : category.category
                  )
                }
                className="w-full flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold">{category.category}</h2>
                </div>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${
                    expandedCategory === category.category ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedCategory === category.category && (
                <div className="mt-2 space-y-3 pl-4 border-l-2 border-cyan-500/50">
                  {category.items.map((item, idx) => (
                    <div key={idx} className="py-3">
                      <h3 className="font-semibold text-white mb-2">
                        {item.question}
                      </h3>
                      <p className="text-white/70 text-sm leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Support Info */}
        <div className="mt-12 p-6 rounded-lg bg-white/5 border border-white/10">
          <h3 className="text-lg font-semibold mb-3">Still need help?</h3>
          <p className="text-white/70 mb-4">
            If you can't find the answer you're looking for, please reach out to our support team.
          </p>
          <div className="flex gap-3">
            <a
              href="mailto:support@contentflow.ai"
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors"
            >
              Contact Support
            </a>
            <a
              href="https://github.com/contentflow"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
