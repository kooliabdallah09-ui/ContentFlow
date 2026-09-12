import ComingSoon from '@/components/ComingSoon'
import { AdminOnlyPage } from '@/components/AdminOnlyPage'

export default function EmailPage() {
  return (
    <AdminOnlyPage>
      <ComingSoon
        feature="Email Writer"
        description="Welcome sequences, product launches, abandoned-cart flows. Email copy that matches your brand voice with subject-line A/B variants."
        alternative={{ label: 'Generate a UGC video', href: '/generate/ugc' }}
      />
    </AdminOnlyPage>
  )
}
