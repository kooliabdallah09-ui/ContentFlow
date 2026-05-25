'use client'

import { Download, Save, Loader } from 'lucide-react'
import { Icon } from '@/components/Icons'
import Image from 'next/image'
import { useState } from 'react'

interface ImagePreviewProps {
  images: string[]
  isLoading: boolean
  error?: string
}

export default function ImagePreview({
  images,
  isLoading,
  error,
}: ImagePreviewProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const handleDownload = async (imageUrl: string, index: number) => {
    setDownloading(imageUrl)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-image-${Date.now()}-${index}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(null)
    }
  }

  const handleSave = (imageUrl: string) => {
    const newSaved = new Set(saved)
    if (newSaved.has(imageUrl)) {
      newSaved.delete(imageUrl)
    } else {
      newSaved.add(imageUrl)
    }
    setSaved(newSaved)
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
            <p className="text-white/60">Generating your image...</p>
            <p className="text-sm text-white/40 mt-2">
              This typically takes 2-5 seconds
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
      {!isLoading && !error && images.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block p-4 bg-white/5 rounded-full mb-4">
              <Icon.Image style={{ width: 32, height: 32, opacity: 0.3 }} />
            </div>
            <p className="text-white/60">Your generated images will appear here</p>
            <p className="text-sm text-white/40 mt-2">
              Fill in the details and click Generate Image to get started
            </p>
          </div>
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && !isLoading && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4">
            {images.map((imageUrl, index) => (
              <div
                key={index}
                className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400/30 transition"
              >
                {/* Image Container */}
                <div className="relative w-full aspect-square bg-black/50">
                  <img
                    src={imageUrl}
                    alt={`Generated image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Overlay with Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleDownload(imageUrl, index)}
                    disabled={downloading === imageUrl}
                    className="p-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/20 rounded-full transition"
                    title="Download image"
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>

                  <button
                    onClick={() => handleSave(imageUrl)}
                    className={`p-3 rounded-full transition ${
                      saved.has(imageUrl)
                        ? 'bg-emerald-500'
                        : 'bg-white/20 hover:bg-white/30'
                    }`}
                    title={saved.has(imageUrl) ? 'Saved' : 'Save to library'}
                  >
                    <Save className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Image Number */}
                <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 rounded-full text-xs font-600 text-white/70">
                  #{index + 1}
                </div>

                {/* Loading Indicator */}
                {downloading === imageUrl && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
