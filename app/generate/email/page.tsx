import ComingSoon from '@/components/ComingSoon'

export default function EmailPage() {
  return (
    <ComingSoon
      feature="Email Writer"
      description="Welcome sequences, product launches, abandoned-cart flows. Email copy that matches your brand voice with subject-line A/B variants."
      alternative={{ label: 'Generate a UGC video', href: '/generate/ugc' }}
    />
  )
}
