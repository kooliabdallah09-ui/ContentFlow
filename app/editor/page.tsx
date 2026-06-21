'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import VideoEditor from '@/components/VideoEditor'

function EditorInner() {
  const params = useSearchParams()
  const videoUrl = params.get('videoUrl') ?? ''
  const duration = parseFloat(params.get('duration') ?? '10')
  const aspect = (params.get('aspect') ?? '9:16') as '9:16' | '1:1' | '16:9'
  return <VideoEditor initialVideoUrl={videoUrl} initialDuration={duration} initialAspect={aspect} />
}

export default function EditorPage() {
  return (
    <Suspense>
      <EditorInner />
    </Suspense>
  )
}
