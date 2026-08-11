'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Icon } from '@/components/Icons'

type Format = 'jpeg' | 'webp' | 'avif' | 'png'

interface Props {
  imageUrl: string
  filename?: string
  onClose: () => void
}

const FORMAT_LABELS: Record<Format, string> = {
  jpeg: 'JPEG',
  webp: 'WebP',
  avif: 'AVIF',
  png: 'PNG (lossless)',
}

const FORMAT_EXT: Record<Format, string> = {
  jpeg: 'jpg',
  webp: 'webp',
  avif: 'avif',
  png: 'png',
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function loadImageAndGetCanvas(url: string): Promise<{ canvas: HTMLCanvasElement; originalSize: number }> {
  const response = await fetch(url)
  const blob = await response.blob()
  const originalSize = blob.size
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext('2d')!.drawImage(bmp, 0, 0)
  bmp.close()
  return { canvas, originalSize }
}

async function canvasToBlob(canvas: HTMLCanvasElement, format: Format, quality: number): Promise<Blob> {
  const mime = format === 'jpeg' ? 'image/jpeg'
    : format === 'webp' ? 'image/webp'
    : format === 'avif' ? 'image/avif'
    : 'image/png'
  const q = format === 'png' ? undefined : quality / 100
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Encoding failed')), mime, q)
  })
}

export default function CompressModal({ imageUrl, filename, onClose }: Props) {
  const [format, setFormat] = useState<Format>('webp')
  const [quality, setQuality] = useState(82)
  const [originalSize, setOriginalSize] = useState<number | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    loadImageAndGetCanvas(imageUrl)
      .then(({ canvas, originalSize }) => {
        if (cancelled) return
        canvasRef.current = canvas
        setOriginalSize(originalSize)
        runCompress(format, quality, canvas)
      })
      .catch(() => setError('Failed to load image'))
    return () => { cancelled = true }
  }, [imageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const runCompress = useCallback(async (fmt: Format, q: number, canvas?: HTMLCanvasElement) => {
    const c = canvas ?? canvasRef.current
    if (!c) return
    setCompressing(true)
    setError(null)
    try {
      const blob = await canvasToBlob(c, fmt, q)
      setCompressedBlob(blob)
    } catch {
      setError(`${fmt.toUpperCase()} not supported in this browser. Try JPEG or WebP.`)
    } finally {
      setCompressing(false)
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runCompress(format, quality), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [format, quality, runCompress])

  const savings = originalSize && compressedBlob
    ? Math.round((1 - compressedBlob.size / originalSize) * 100)
    : null

  const handleDownload = () => {
    if (!compressedBlob) return
    const baseName = (filename ?? 'image').replace(/\.[^.]+$/, '')
    const url = URL.createObjectURL(compressedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}-compressed.${FORMAT_EXT[format]}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: '100%', maxWidth: 480,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Compress Image</span>
          <button className="icon-btn" style={{ padding: 6 }} onClick={onClose}>
            <Icon.X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Format picker */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 10 }}>
              Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {(Object.keys(FORMAT_LABELS) as Format[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    padding: '8px 0',
                    borderRadius: 'var(--r-sm)',
                    border: '1.5px solid',
                    borderColor: format === f ? 'var(--accent)' : 'var(--border)',
                    background: format === f ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface)',
                    color: format === f ? 'var(--accent)' : 'var(--ink)',
                    fontSize: 13,
                    fontWeight: format === f ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {f === 'png' ? 'PNG' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Quality slider (hidden for PNG) */}
          {format !== 'png' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quality
                </label>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{quality}</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--ink-fade)' }}>
                <span>Smaller file</span>
                <span>Best quality</span>
              </div>
            </div>
          )}

          {/* Size stats */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', gap: 0 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-fade)', marginBottom: 4 }}>Original</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                {originalSize ? formatBytes(originalSize) : '—'}
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--border)', margin: '0 12px' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-fade)', marginBottom: 4 }}>Compressed</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                {compressing ? (
                  <span style={{ color: 'var(--ink-mute)', fontSize: 13 }}>...</span>
                ) : compressedBlob ? (
                  formatBytes(compressedBlob.size)
                ) : '—'}
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--border)', margin: '0 12px' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-fade)', marginBottom: 4 }}>Saved</div>
              <div style={{
                fontSize: 15, fontWeight: 600,
                color: savings && savings > 0 ? '#1a9e5a' : savings && savings < 0 ? 'var(--danger)' : 'var(--ink)',
              }}>
                {compressing ? (
                  <span style={{ color: 'var(--ink-mute)', fontSize: 13 }}>...</span>
                ) : savings !== null ? (
                  `${savings > 0 ? '-' : '+'}${Math.abs(savings)}%`
                ) : '—'}
              </div>
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', margin: 0 }}>{error}</p>
          )}

          <button
            className="btn btn-primary"
            disabled={!compressedBlob || compressing}
            onClick={handleDownload}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon.Arrow style={{ width: 14, height: 14 }} />
            Download {format !== 'png' ? `${FORMAT_LABELS[format]} (q${quality})` : 'PNG'}
          </button>
        </div>
      </div>
    </div>
  )
}
