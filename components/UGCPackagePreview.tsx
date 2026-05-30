'use client'

import { Download, Copy, Loader, Film } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

interface VideoComponent {
  videoId?: string
  videoUrl?: string
  status: 'processing' | 'completed' | 'failed'
  estimatedDuration?: number
  duration?: number
}

interface UGCComponent {
  image?: { url: string; id: string }
  video?: VideoComponent
  script?: string
}

interface UGCPackagePreviewProps {
  components: UGCComponent | null
  ugcType: string
  isLoading: boolean
  error?: string
}

export default function UGCPackagePreview({ components, ugcType, isLoading, error }: UGCPackagePreviewProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoComponent | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start polling when we get a video with processing status
  useEffect(() => {
    if (components?.video) setVideo(components.video)
  }, [components])

  useEffect(() => {
    if (!video?.videoId || video.status !== 'processing') return

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/video-status?videoId=${video.videoId}`)
        const data = await res.json()
        if (data.status === 'completed' || data.status === 'failed') {
          setVideo(prev => prev ? { ...prev, status: data.status, videoUrl: data.videoUrl, duration: data.duration } : prev)
          clearInterval(pollRef.current!)
        }
      } catch {}
    }, 5000)

    return () => clearInterval(pollRef.current!)
  }, [video?.videoId, video?.status])

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

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
      <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '50%' }}>
        <Loader style={{ width: 28, height: 28, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
      </div>
      <p style={{ fontSize: '14px', color: 'var(--ink-dim)', textAlign: 'center' }}>Generating your UGC package…</p>
      <p style={{ fontSize: '12px', color: 'var(--ink-fade)', textAlign: 'center' }}>Claude is writing the script, Flux is generating the image</p>
    </div>
  )

  if (error && !isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
      <p style={{ fontSize: '14px', color: 'var(--bad)', fontWeight: 600 }}>{error}</p>
      <p style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>Check your input and try again</p>
    </div>
  )

  if (!components) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px', opacity: 0.5 }}>
      <Film style={{ width: 36, height: 36, color: 'var(--ink-dim)' }} />
      <p style={{ fontSize: '14px', color: 'var(--ink-dim)' }}>Your UGC package will appear here</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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

      {/* Video */}
      {video && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            Avatar Video
          </h3>

          {video.status === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '12px', background: 'var(--bg)', borderRadius: 'var(--r-md)', marginBottom: '12px' }}>
              <Loader style={{ width: 24, height: 24, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>HeyGen is rendering your video…</p>
              <p style={{ fontSize: '11px', color: 'var(--ink-fade)' }}>Usually takes 2–5 minutes. This page auto-updates.</p>
            </div>
          )}

          {video.status === 'failed' && (
            <p style={{ fontSize: '13px', color: 'var(--bad)', marginBottom: '12px' }}>Video generation failed. Try again.</p>
          )}

          {video.status === 'completed' && video.videoUrl && (
            <>
              <video controls src={video.videoUrl} style={{ width: '100%', borderRadius: 'var(--r-md)', marginBottom: '12px', maxHeight: '400px', background: '#000' }} />
              {video.duration && (
                <p style={{ fontSize: '12px', color: 'var(--ink-fade)', marginBottom: '12px' }}>Duration: {video.duration}s</p>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleDownload(video.videoUrl!, `ugc-video-${Date.now()}.mp4`)} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
                  <Download style={{ width: 14, height: 14 }} />
                  Download
                </button>
                <button onClick={() => handleCopy(video.videoUrl!, 'video')} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
                  <Copy style={{ width: 14, height: 14 }} />
                  {copied === 'video' ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
