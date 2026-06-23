'use client'

import { Download, Copy, Loader, Film } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface VideoComponent {
  videoId?: string
  videoUrl?: string
  videoUrls?: string[]                       // Chained Kling clips, in order. Length 1 normally, 2 for 20s.
  status: 'processing' | 'completed' | 'failed'
  estimatedDuration?: number
  duration?: number                           // TOTAL video duration (sum of all clips)
  provider?: 'heygen' | 'sora-2' | 'kling-v3-omni'
  chainedIds?: string[]                       // Additional Kling prediction ids to poll alongside videoId
  error?: string  // Surfaced when the A-roll generation fails — content policy, billing, etc.
}

interface BrollClip {
  taskId: string
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  label?: string
}

interface UGCComponent {
  image?: { url: string; id: string }
  video?: VideoComponent
  broll?: BrollClip[]
  script?: string
  audioOverlayUrl?: string  // Hero tier: ElevenLabs voice to overlay on the muted Sora video
  language?: string         // ISO-639-1 code — drives Whisper transcription hint
  aspect?: 'portrait' | 'square' | 'landscape'  // Drives the stitch output size + preview aspect
}

interface UGCPackagePreviewProps {
  components: UGCComponent | null
  ugcType: string
  isLoading: boolean
  error?: string
  creditDeducted?: number
}

export default function UGCPackagePreview({ components, ugcType, isLoading, error, creditDeducted }: UGCPackagePreviewProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoComponent | null>(null)
  const [brolls, setBrolls] = useState<BrollClip[]>([])
  const [stitchRenderId, setStitchRenderId] = useState<string | null>(null)
  const [stitchStatus, setStitchStatus] = useState<'idle' | 'stitching' | 'completed' | 'failed'>('idle')
  const [stitchError, setStitchError] = useState<string | null>(null)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)
  const [audioOverlayUrl, setAudioOverlayUrl] = useState<string | undefined>(undefined)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stitchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stitchStartedRef = useRef(false)

  useEffect(() => {
    if (components?.video) setVideo(components.video)
    if (components?.broll) setBrolls(components.broll)
    if (components?.audioOverlayUrl) setAudioOverlayUrl(components.audioOverlayUrl)
  }, [components])

  // Main video + B-roll polling
  useEffect(() => {
    const videoProcessing = video?.videoId && video.status === 'processing'
    const brollProcessing = brolls.some(b => b.status === 'processing')
    if (!videoProcessing && !brollProcessing) return

    pollRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams()
        if (video?.videoId && video.status === 'processing') {
          params.set('videoId', video.videoId)
          if (video.provider) params.set('provider', video.provider)
          if (video.chainedIds?.length) params.set('chainedIds', video.chainedIds.join(','))
        }
        const processingBrolls = brolls.filter(b => b.status === 'processing')
        if (processingBrolls.length) params.set('brollTaskIds', processingBrolls.map(b => b.taskId).join(','))

        const res = await fetch(`/api/ugc/video-status?${params}`)
        const data = await res.json()

        if (data.video) {
          const v = data.video
          if (v.status === 'completed' || v.status === 'failed') {
            setVideo(prev => prev ? {
              ...prev,
              status: v.status,
              videoUrl: v.videoUrl,
              videoUrls: v.videoUrls,
              duration: v.duration ?? prev.duration,
              error: v.error,
            } : prev)
          }
        }

        if (data.broll?.length) {
          setBrolls(prev => prev.map(b => {
            const updated = data.broll.find((u: BrollClip) => u.taskId === b.taskId)
            return updated ? { ...b, status: updated.status, videoUrl: updated.videoUrl } : b
          }))
        }

        const allDone = (!video?.videoId || video.status !== 'processing' || data.video?.status === 'completed' || data.video?.status === 'failed')
          && (!brolls.some(b => b.status === 'processing') || data.broll?.every((b: BrollClip) => b.status === 'completed' || b.status === 'failed'))
        if (allDone) clearInterval(pollRef.current!)
      } catch {}
    }, 5000)

    return () => clearInterval(pollRef.current!)
  }, [video?.videoId, video?.status, brolls.length])

  // When the talking head is ready, promote it directly to Final Video — no Shotstack, no B-rolls.
  useEffect(() => {
    if (stitchStartedRef.current) return
    if (video?.status !== 'completed' || !video.videoUrl) return
    stitchStartedRef.current = true
    setFinalVideoUrl(video.videoUrl)
    setStitchStatus('completed')
  }, [video?.status, video?.videoUrl])

  const handleDownload = async (url: string, filename: string) => {
    setDownloading(filename)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = window.URL.createObjectURL(blob)
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(a.href)
    } catch {}
    finally { setDownloading(null) }
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // Pick the CSS aspect for the preview <video> elements based on what the
  // user generated. Square → 1/1, landscape → 16/9, default portrait → 9/16.
  const previewAspectRatio =
    components?.aspect === 'square'    ? '1 / 1' :
    components?.aspect === 'landscape' ? '16 / 9' :
                                         '9 / 16'

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
      <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '50%' }}>
        <Loader style={{ width: 28, height: 28, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
      </div>
      <p style={{ fontSize: '14px', color: 'var(--ink-dim)', textAlign: 'center' }}>Generating your UGC package…</p>
      <p style={{ fontSize: '12px', color: 'var(--ink-fade)', textAlign: 'center' }}>Writing the script, generating your avatar image…</p>
    </div>
  )

  if (error && !isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
      <p style={{ fontSize: '14px', color: 'var(--bad)', fontWeight: 600 }}>{error}</p>
      <p style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>Check your input and try again</p>
    </div>
  )

  if (!components) return (
    <div className="card" style={{ padding: '14px' }}>
      <div style={{
        aspectRatio: '0.62', borderRadius: 11,
        background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 9px, var(--surface-3) 9px 18px)',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, textAlign: 'center', padding: 20,
      }}>
        <Film style={{ width: 28, height: 28, color: 'var(--ink-faint)' }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          Your preview appears<br/>here as it renders.
        </span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Cost badge */}
      {creditDeducted !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 11,
          background: 'var(--hover)', border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Generation cost</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>
            {creditDeducted} cr
          </span>
        </div>
      )}

      {/* Script */}
      {components.script && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
              AI Script
            </h3>
            <button
              onClick={() => handleCopy(components.script!, 'script')}
              className="btn btn-ghost"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <Copy style={{ width: 12, height: 12 }} />
              {copied === 'script' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
            {components.script}
          </p>
        </div>
      )}

      {/* Image */}
      {components.image && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            Product Image
          </h3>
          <img
            src={components.image.url}
            alt="Generated product"
            style={{ width: '100%', borderRadius: 'var(--r-md)', marginBottom: '12px', maxHeight: '300px', objectFit: 'contain', background: 'var(--bg)' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => handleDownload(components.image!.url, `product-${Date.now()}.png`)} disabled={!!downloading} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
              <Download style={{ width: 14, height: 14 }} />
              {downloading === 'image' ? 'Downloading…' : 'Download'}
            </button>
            <button onClick={() => handleCopy(components.image!.url, 'image')} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
              <Copy style={{ width: 14, height: 14 }} />
              {copied === 'image' ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
      )}


      {/* Final stitched video */}
      {stitchStatus !== 'idle' && (
        <div className="card" style={{ padding: '20px', border: '1px solid var(--accent)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            ✦ Final Video
          </h3>


          {stitchStatus === 'completed' && finalVideoUrl && (
            <>
              <video controls src={finalVideoUrl} style={{ width: '100%', aspectRatio: previewAspectRatio, borderRadius: 'var(--r-md)', marginBottom: '12px', background: '#000', display: 'block', objectFit: 'contain' }} />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button onClick={() => handleDownload(finalVideoUrl, `final-ugc-${Date.now()}.mp4`)} className="btn btn-primary" style={{ flex: 1, fontSize: '13px' }}>
                  <Download style={{ width: 14, height: 14 }} />
                  Download Final Video
                </button>
                <button onClick={() => handleCopy(finalVideoUrl, 'final')} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
                  <Copy style={{ width: 14, height: 14 }} />
                  {copied === 'final' ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
              <Link
                href={`/editor?videoUrl=${encodeURIComponent(finalVideoUrl)}&aspect=${components?.aspect === 'square' ? '1:1' : components?.aspect === 'landscape' ? '16:9' : '9:16'}`}
                className="btn btn-ghost"
                style={{ width: '100%', textAlign: 'center', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Film style={{ width: 14, height: 14 }} />
                Edit in Editor
              </Link>
            </>
          )}
        </div>
      )}

      {/* Render-in-progress card — shown while Kling is still working */}
      {video && video.status === 'processing' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            ✦ Your Video
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '12px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
            <Loader style={{ width: 24, height: 24, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Rendering your video…</p>
            <p style={{ fontSize: '11px', color: 'var(--ink-fade)' }}>Usually 2–4 minutes. This page auto-updates.</p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {video && video.status === 'failed' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--bad)', marginBottom: '12px' }}>
            Generation Failed
          </h3>
          {video.error ? (
            <p style={{ fontSize: '11px', color: 'var(--ink-fade)', fontFamily: 'var(--font-mono)', wordBreak: 'break-word', padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', lineHeight: 1.5 }}>
              {video.error}
            </p>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--ink-fade)' }}>No detail returned. Check your API keys or try again.</p>
          )}
        </div>
      )}
    </div>
  )
}
