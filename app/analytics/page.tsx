import ComingSoon from '@/components/ComingSoon'

export default function AnalyticsPage() {
  return (
    <ComingSoon
      feature="Analytics"
      description="Track which UGC ads convert. Hook performance, watch time, CTR, attribution to revenue — pulled from your connected social accounts and ad platforms."
      alternative={{ label: 'Make more UGC variants', href: '/generate/ugc' }}
    />
  )
}
