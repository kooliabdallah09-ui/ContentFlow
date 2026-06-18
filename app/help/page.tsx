import ComingSoon from '@/components/ComingSoon'

export default function HelpPage() {
  return (
    <ComingSoon
      feature="Help Center"
      description="Searchable docs, video walkthroughs, troubleshooting guides, and direct support. Until then, use Ask AI in the sidebar — it knows everything about ContentFlow."
      alternative={{ label: 'Ask AI', href: '/ask' }}
    />
  )
}
