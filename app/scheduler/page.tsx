import ComingSoon from '@/components/ComingSoon'

export default function SchedulerPage() {
  return (
    <ComingSoon
      feature="Post Scheduler"
      description="Queue up your UGC videos and content posts across TikTok, Instagram, X, and LinkedIn from one calendar. Set times, batch upload, track what went live."
      alternative={{ label: 'Generate a UGC video', href: '/generate/ugc' }}
    />
  )
}
