'use client'

import { Download, Copy, Loader, Image, Volume2, Film } from 'lucide-react'
import { useState } from 'react'

interface UGCComponent {
  image?: { url: string; id: string }
  voice?: { url: string; duration: number }
  video?: { url: string; id: string; duration: number }
}

interface UGCPackagePreviewProps {
  components: UGCComponent | null
  ugcType: string
  isLoading: boolean
  error?: string
}

export default function UGCPackagePreview({
  components,
  ugcType,
  isLoading,
  error,
}: UGCPackagePreviewProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleDownload = async (url: string, filename: string) => {
    setDownloading(filename)
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(null)
    }
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <p className="text-white/60">Generating your UGC package...</p>
            <p className="text-sm text-white/40 mt-2">
              This may take 1-2 minutes for complete packages
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
      {!isLoading && !error && !components && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block p-4 bg-white/5 rounded-full mb-4">
              <PackageIcon className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/60">Your UGC package will appear here</p>
            <p className="text-sm text-white/40 mt-2">
              Fill in the product details to generate your complete UGC package
            </p>
          </div>
        </div>
      )}

      {/* Package Preview */}
      {components && !isLoading && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Image Component */}
          {components.image && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Image className="w-5 h-5 text-cyan-400" />
                <h3 className="font-600 text-white">Product Image</h3>
              </div>
              <div className="bg-black rounded-lg overflow-hidden mb-3 max-h-48">
                <img
                  src={components.image.url}
                  alt="Generated product image"
                  className="w-full h-auto object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleDownload(
                      components.image!.url,
                      `ugc-image-${Date.now()}.png`
                    )
                  }
                  disabled={downloading === 'image'}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 border border-white/20 text-white font-600 rounded-lg transition text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => handleCopyUrl(components.image!.url)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-600 rounded-lg transition text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy URL
                </button>
              </div>
            </div>
          )}

          {/* Voice Component */}
          {components.voice && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-5 h-5 text-cyan-400" />
                <h3 className="font-600 text-white">Voiceover</h3>
              </div>
              <div className="bg-black rounded-lg p-3 mb-3">
                <audio
                  controls
                  src={components.voice.url}
                  className="w-full h-8"
                />
              </div>
              <p className="text-xs text-white/50 mb-3">
                Duration: {components.voice.duration}s
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleDownload(
                      components.voice!.url,
                      `ugc-voiceover-${Date.now()}.mp3`
                    )
                  }
                  disabled={downloading === 'voice'}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 border border-white/20 text-white font-600 rounded-lg transition text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => handleCopyUrl(components.voice!.url)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-600 rounded-lg transition text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy URL
                </button>
              </div>
            </div>
          )}

          {/* Video Component */}
          {components.video && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Film className="w-5 h-5 text-cyan-400" />
                <h3 className="font-600 text-white">Video</h3>
              </div>
              <div className="bg-black rounded-lg overflow-hidden mb-3 max-h-48">
                <video
                  controls
                  src={components.video.url}
                  className="w-full h-auto object-contain"
                />
              </div>
              <p className="text-xs text-white/50 mb-3">
                Duration: {components.video.duration}s
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleDownload(
                      components.video!.url,
                      `ugc-video-${Date.now()}.mp4`
                    )
                  }
                  disabled={downloading === 'video'}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 border border-white/20 text-white font-600 rounded-lg transition text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => handleCopyUrl(components.video!.url)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-600 rounded-lg transition text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy URL
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PackageIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}
