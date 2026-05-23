'use client'

import { Download, Play, Pause, Loader, Copy } from 'lucide-react'
import { useState, useRef } from 'react'

interface VoicePreviewProps {
  audioUrl: string | null
  duration: number
  isLoading: boolean
  error?: string
  characterCount?: number
}

export default function VoicePreview({
  audioUrl,
  duration,
  isLoading,
  error,
  characterCount = 0,
}: VoicePreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handlePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleDownload = async () => {
    if (!audioUrl) return

    setDownloading(true)
    try {
      const response = await fetch(audioUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-voice-${Date.now()}.mp3`
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
    if (!audioUrl) return
    navigator.clipboard.writeText(audioUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
            <p className="text-white/60">Synthesizing your voice...</p>
            <p className="text-sm text-white/40 mt-2">
              This typically takes 10-30 seconds
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
      {!isLoading && !error && !audioUrl && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block p-4 bg-white/5 rounded-full mb-4">
              <Volume2Icon className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/60">Your generated voice will appear here</p>
            <p className="text-sm text-white/40 mt-2">
              Fill in the text and select a voice to get started
            </p>
          </div>
        </div>
      )}

      {/* Audio Player */}
      {audioUrl && !isLoading && (
        <div className="flex-1 flex flex-col">
          <div className="glass-card rounded-xl p-6 mb-4">
            <div className="space-y-4">
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="hidden"
              />

              {/* Player Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayPause}
                  className="flex-shrink-0 p-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-full transition"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-1" />
                  )}
                </button>

                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = parseFloat(e.target.value)
                        setCurrentTime(parseFloat(e.target.value))
                      }
                    }}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div className="text-sm font-600 text-white/70 w-16 text-right">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                <div>
                  <p className="text-xs text-white/60 mb-1">Duration</p>
                  <p className="font-600 text-white">{duration}s</p>
                </div>
                {characterCount > 0 && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Characters</p>
                    <p className="font-600 text-white">{characterCount}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 border border-white/20 text-white font-600 rounded-lg transition"
              title="Download audio"
            >
              <Download className="w-5 h-5" />
              {downloading ? 'Downloading...' : 'Download'}
            </button>

            <button
              onClick={handleCopyUrl}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-600 rounded-lg transition"
              title="Copy URL"
            >
              <Copy className="w-5 h-5" />
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Volume2Icon(props: React.SVGProps<SVGSVGElement>) {
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
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a7 7 0 0 1 0 9.9M19.07 4.93a11 11 0 0 1 0 15.66" />
    </svg>
  )
}
