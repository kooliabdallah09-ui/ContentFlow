import ComingSoon from '@/components/ComingSoon'

export default function BlogPage() {
  return (
    <ComingSoon
      feature="Blog Post Writer"
      description="Long-form blog posts in your brand voice, fully SEO-optimized, with auto-generated images and outline-first editing."
      alternative={{ label: 'Try the UGC generator', href: '/generate/ugc' }}
    />
  )
}
