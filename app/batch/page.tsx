import ComingSoon from '@/components/ComingSoon'

export default function BatchPage() {
  return (
    <ComingSoon
      feature="Batch Generation"
      description="Spin up 5 to 50 variants of the same UGC ad in one job — different hooks, characters, voices, B-rolls. Perfect for split-testing in feed."
      alternative={{ label: 'Generate a single UGC video', href: '/generate/ugc' }}
    />
  )
}
