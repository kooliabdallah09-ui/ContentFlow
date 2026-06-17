import ComingSoon from '@/components/ComingSoon'

export default function CalendarPage() {
  return (
    <ComingSoon
      feature="Content Calendar"
      description="Plan a month of posts in one click. AI-generated monthly content plan tied to your brand voice with drag-and-drop scheduling across all your platforms."
      alternative={{ label: 'Generate a UGC video instead', href: '/generate/ugc' }}
    />
  )
}
