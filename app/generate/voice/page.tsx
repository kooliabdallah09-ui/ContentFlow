import ComingSoon from '@/components/ComingSoon'

export default function VoicePage() {
  return (
    <ComingSoon
      feature="Voiceover Studio"
      description="Standalone voiceovers in your branded ElevenLabs voice — script-to-MP3 for podcasts, reels, narration, internal recordings."
      alternative={{ label: 'Generate a UGC video', href: '/generate/ugc' }}
    />
  )
}
