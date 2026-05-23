'use client'

import { Download, Share2, Copy, Loader, Play } from 'lucide-react'
import { useState } from 'react'

interface VideoPreviewProps {
  videoUrl: string | null
  duration: number
  isLoading: boolean
  error?: string
}

export default function VideoPreview({
  videoUrl,
  duration,
  isLoading,
  error,
}: VideoPreviewProps) {
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleDownload = async () => {
    if (!videoUrl) return

    setDownloading(true)
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-video-${Date.now()}.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  const handleCopyUrl = () => {
    if (!videoUrl) return
    navigator.clipboard.writeText(videoUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!videoUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Generated Video',
          text: 'Check out this AI-generated video!',
          url: videoUrl,
        })
      } catch (err) {
        console.error('Share failed:', err)
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block p-4 bg-white/5 rounded-full mb-4 animate-pulse">
              <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
            <p className="text-white/60">Generating your video...</p>
            <p className="text-sm text-white/40 mt-2">
              This may take 30-60 seconds depending on length
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block p-3 bg-red-500/10 rounded-full mb-4">
              <div className="w-8 h-8 text-red-400">!</div>
            </div>
            <p className="text-red-400 font-500">{error}</p>
            <p className="text-sm text-white/40 mt-2">
              Please check your input and try again
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !videoUrl && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block p-4 bg-white/5 rounded-full mb-4">
              <Film2Icon className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/60">Your generated video will appear here</p>
            <p className="text-sm text-white/40 mt-2">
              Write your script and select an avatar and voice to get started
            </p>
          </div>
        </div>
      )}

      {/* Video Player */}
      {videoUrl && !isLoading && (
        <div className="flex-1 flex flex-col">
          <div className="glass-card rounded-xl p-6 mb-4 flex-1 flex flex-col">
            {/* Video Container */}
            <div className="relative w-full bg-black rounded-lg overflow-hidden mb-4 flex-1 flex items-center justify-center group">
              <video
                src={videoUrl}
                controls
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => {
                  const video = document.querySelector(
                    'video'
                  ) as HTMLVideoElement
                  video?.play()
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition"
              >
                <Play className="w-16 h-16 text-white fill-white" />
              </button>
            </div>

            {/* Info */}
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-xs text-white/60 mb-1">Duration</p>
                <p className="font-600 text-white">{duration}s</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60 mb-1">Format</p>
                <p className="font-600 text-white">MP4</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 border border-white/20 text-white font-600 rounded-lg transition text-sm"
              title="Download video"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Downloading...' : 'Download'}
            </button>

            <button
              onClick={handleCopyUrl}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-600 rounded-lg transition text-sm"
              title="Copy URL"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy URL'}
            </button>

            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-600 rounded-lg transition text-sm"
              title="Share video"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Film2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  )
}
