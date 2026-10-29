import { MarketingHeader } from '@/components/MarketingHeader'
import { MarketingFooter } from '@/components/MarketingFooter'

// Wraps a public page in the shared header/footer. Used by route layouts for
// pages (legal, blog posts) that don't render the chrome themselves.
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </>
  )
}
