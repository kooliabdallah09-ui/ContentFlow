import ComingSoon from '@/components/ComingSoon'
import { MarketingHeader } from '@/components/MarketingHeader'
import { MarketingFooter } from '@/components/MarketingFooter'

export default function HelpPage() {
  return (
    <>
      <MarketingHeader />
      <ComingSoon
        feature="Help Center"
        description="Searchable docs, video walkthroughs, troubleshooting guides, and direct support. Until then, use Ask AI in the sidebar — it knows everything about ContentFlow."
        alternative={{ label: 'Ask AI', href: '/ask' }}
      />
      <MarketingFooter />
    </>
  )
}
