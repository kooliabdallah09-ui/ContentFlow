'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { EditSpec, TextOverlay, ImageOverlay, EMPTY_EDIT_SPEC, MUSIC_LIBRARY, DEFAULT_FILTERS } from '@/lib/edit-spec'
import { getSupabase } from '@/lib/auth'

interface VideoEditorProps {
  initialVideoUrl?: string
  initialDuration?: number
  initialAspect?: '9:16' | '1:1' | '16:9'
}

type Panel = 'trim' | 'text' | 'image' | 'adjust' | 'music' | 'ai' | 'export'

function genId() { return Math.random().toString(36).slice(2, 9) }
function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${String(sec).padStart(2, '0')}.${ms}`
}

const PANEL_TABS: { id: Panel; icon: string; label: string }[] = [
  { id: 'trim',   icon: '✂',  label: 'Trim'   },
  { id: 'text',   icon: 'T',  label: 'Text'   },
  { id: 'image',  icon: '⊡',  label: 'Image'  },
  { id: 'adjust', icon: '✦',  label: 'Adjust' },
  { id: 'music',  icon: '♪',  label: 'Music'  },
  { id: 'ai',     icon: '✧',  label: 'AI'     },
  { id: 'export', icon: '↗',  label: 'Export' },
]

const FILTER_PRESETS: Record<string, { brightness: number; contrast: number; saturation: number }> = {
  none:    { brightness: 1,    contrast: 1,    saturation: 1    },
  bw:      { brightness: 1,    contrast: 1.1,  saturation: 0    },
  vintage: { brightness: 1.05, contrast: 0.9,  saturation: 0.8  },
  vivid:   { brightness: 1.05, contrast: 1.2,  saturation: 1.5  },
  cinema:  { brightness: 0.9,  contrast: 1.3,  saturation: 0.85 },
  muted:   { brightness: 1,    contrast: 0.85, saturation: 0.6  },
  warm:    { brightness: 1.05, contrast: 1.05, saturation: 1.2  },
  cool:    { brightness: 1.0,  contrast: 1.1,  saturation: 0.85 },
  fade:    { brightness: 1.1,  contrast: 0.82, saturation: 0.7  },
  punch:   { brightness: 1.0,  contrast: 1.35, saturation: 1.45 },
}

const PRESET_LABELS: Record<string, string> = {
  none: 'None', bw: 'B&W', vintage: 'Vintage', vivid: 'Vivid', cinema: 'Cinema', muted: 'Muted',
  warm: 'Warm', cool: 'Cool', fade: 'Fade', punch: 'Punch',
}

const CAPTION_STYLES = [
  { id: 'caption',   label: 'Default',   preview: { bg: 'rgba(0,0,0,0.6)', color: '#fff',    outline: false } },
  { id: 'tiktok',    label: 'TikTok',    preview: { bg: 'transparent',     color: '#fff',    outline: true  } },
  { id: 'highlight', label: 'Highlight', preview: { bg: '#FFE14D',         color: '#000',    outline: false } },
  { id: 'bubble',    label: 'Bubble',    preview: { bg: '#ffffff',         color: '#1a1a17', outline: false } },
  { id: 'outline',   label: 'Outline',   preview: { bg: 'transparent',     color: '#FFE14D', outline: true  } },
] as const

const COLOR_SWATCHES = [
  { hex: '#ffffff', label: 'White' },
  { hex: '#000000', label: 'Black' },
  { hex: '#FFE14D', label: 'Yellow' },
  { hex: '#FF4444', label: 'Red' },
  { hex: '#4D9FFF', label: 'Blue' },
  { hex: '#4DFF91', label: 'Green' },
  { hex: '#FF6BF5', label: 'Pink' },
  { hex: '#FF8C00', label: 'Orange' },
]

const FONT_FAMILIES: { id: TextOverlay['fontFamily']; label: string; css: string }[] = [
  { id: 'sans',    label: 'Clean',   css: 'Inter,Arial,sans-serif' },
  { id: 'rounded', label: 'Round',   css: '"Nunito","Varela Round",Arial,sans-serif' },
  { id: 'mono',    label: 'Mono',    css: '"Courier New",Courier,monospace' },
  { id: 'serif',   label: 'Serif',   css: 'Georgia,"Times New Roman",serif' },
]

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2]

const EMOJI_STICKERS = ['🔥', '⭐', '💯', '🎉', '❤️', '👏', '✨', '💪']

const AI_EXAMPLES = [
  'Add captions throughout',
  'Make it slow motion',
  'Add fade in and out',
  'Boost the colors',
  'Cut the last 2 seconds',
  'Add a bold hook at the start',
  'Add upbeat music at 30% volume',
]

export default function VideoEditor({ initialVideoUrl = '', initialDuration = 0, initialAspect = '9:16' }: VideoEditorProps) {
  const makeInitialSpec = (): EditSpec => ({
    ...EMPTY_EDIT_SPEC,
    videoUrl: initialVideoUrl,
    duration: initialDuration,
    aspectRatio: initialAspect,
    trimEnd: initialDuration,
    volume: 1,
    speed: 1,
    filters: { ...DEFAULT_FILTERS },
    imageOverlays: [],
  })

  const [spec, setSpec] = useState<EditSpec>(makeInitialSpec)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [activePanel, setActivePanel] = useState<Panel>('trim')
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [newText, setNewText] = useState('')
  const [newStart, setNewStart] = useState(0)
  const [newDuration, setNewDuration] = useState(3)
  const [newPosition, setNewPosition] = useState<TextOverlay['position']>('bottom')
  const [newStyle, setNewStyle] = useState<TextOverlay['style']>('bold-white')
  const [newColor, setNewColor] = useState('#ffffff')
  const [newFontSize, setNewFontSize] = useState<TextOverlay['fontSize']>('md')
  const [isMuted, setIsMuted] = useState(false)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [captionLoading, setCaptionLoading] = useState(false)
  const [captionError, setCaptionError] = useState<string | null>(null)
  const [captionLanguage, setCaptionLanguage] = useState('auto')
  const [imgStart, setImgStart] = useState(0)
  const [imgDuration, setImgDuration] = useState(3)
  const [imgScale, setImgScale] = useState(0.3)
  const [imgOpacity, setImgOpacity] = useState(1)
  const [imgUrl, setImgUrl] = useState('')
  const [selectedImgId, setSelectedImgId] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const [savingToLibrary, setSavingToLibrary] = useState(false)
  const [savedToLibrary, setSavedToLibrary] = useState(false)
  const exportBlobRef = useRef<Blob | null>(null)
  const [newAnimation, setNewAnimation] = useState<TextOverlay['animation']>('none')
  const [activeCaptionStyle, setActiveCaptionStyle] = useState<TextOverlay['style']>('caption')
  const [zoomEnabled, setZoomEnabled] = useState(false)
  const [expandedOverlayId, setExpandedOverlayId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const musicInputRef = useRef<HTMLInputElement>(null)
  const musicPreviewRef = useRef<HTMLAudioElement>(null)
  const uploadedFileRef = useRef<File | null>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const isDraggingTrim = useRef<null | 'start' | 'end'>(null)
  const isDraggingPlayhead = useRef(false)
  const timelineRef = useRef<HTMLDivElement>(null)
  const draggingOverlay = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const draggingImg = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Undo/redo history
  const history = useRef<EditSpec[]>([makeInitialSpec()])
  const historyIndex = useRef<number>(0)

  function pushHistory(newSpec: EditSpec) {
    // Truncate forward history
    history.current = history.current.slice(0, historyIndex.current + 1)
    history.current.push(newSpec)
    historyIndex.current = history.current.length - 1
    setSpec(newSpec)
  }

  function undo() {
    if (historyIndex.current <= 0) return
    historyIndex.current -= 1
    setSpec(history.current[historyIndex.current])
  }

  function redo() {
    if (historyIndex.current >= history.current.length - 1) return
    historyIndex.current += 1
    setSpec(history.current[historyIndex.current])
  }

  // Keyboard shortcuts
  // Sync playback speed to video element whenever spec changes
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = spec.speed ?? 1
  }, [spec.speed])

  // Sync video volume
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = spec.volume ?? 1
  }, [spec.volume])

  // Sync music preview: src + volume
  useEffect(() => {
    const el = musicPreviewRef.current
    if (!el) return
    if (spec.music?.url) {
      if (el.src !== spec.music.url) {
        el.src = spec.music.url
        el.load()
      }
      el.volume = spec.music.volume ?? 0.5
    } else {
      el.pause()
      el.src = ''
    }
  }, [spec.music?.url, spec.music?.volume])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); return }
      if (meta && e.key === 'z') { e.preventDefault(); undo(); return }
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        videoRef.current?.[isPlaying ? 'pause' : 'play']()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlaying])

  function loadVideoFile(file: File) {
    const url = URL.createObjectURL(file)
    uploadedFileRef.current = file
    const newS: EditSpec = { ...makeInitialSpec(), videoUrl: url, duration: 0, trimStart: 0, trimEnd: 0 }
    pushHistory(newS)
    setCurrentTime(0)
    setExportUrl(null)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadVideoFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('video/')) loadVideoFile(file)
  }, [])

  async function handleExport() {
    if (!spec.videoUrl) return
    setExporting(true)
    setExportUrl(null)
    setExportStatus('Loading video...')
    setExportProgress(0)

    try {
      const [outW, outH] =
        spec.aspectRatio === '16:9' ? [1920, 1080] :
        spec.aspectRatio === '1:1'  ? [1080, 1080] :
                                      [1080, 1920]

      const trimStart = spec.trimStart ?? 0
      const trimEnd   = spec.trimEnd > 0 ? spec.trimEnd : spec.duration
      const speed     = spec.speed ?? 1

      // Create an off-screen video element. Blob URLs work directly; remote
      // URLs need to be fetched first so the canvas doesn't get tainted.
      const vid = document.createElement('video')
      vid.crossOrigin = 'anonymous'
      vid.playsInline = true

      if (spec.videoUrl.startsWith('blob:')) {
        vid.src = spec.videoUrl
      } else {
        const r = await fetch(spec.videoUrl)
        vid.src = URL.createObjectURL(await r.blob())
      }
      await new Promise<void>((res, rej) => { vid.onloadedmetadata = () => res(); vid.onerror = rej; vid.load() })

      // Preload image overlays
      const imgEls = new Map<string, HTMLImageElement>()
      for (const img of (spec.imageOverlays ?? [])) {
        const el = new Image()
        el.crossOrigin = 'anonymous'
        el.src = img.src
        await new Promise(r => { el.onload = r; el.onerror = r })
        imgEls.set(img.id, el)
      }

      // Canvas
      const canvas = document.createElement('canvas')
      canvas.width  = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Audio graph: video → gain → MediaStreamDestination (for capture) + speakers
      const audioCtx  = new AudioContext()
      const src        = audioCtx.createMediaElementSource(vid)
      const gainNode   = audioCtx.createGain()
      gainNode.gain.value = spec.volume ?? 1
      const audioDest  = audioCtx.createMediaStreamDestination()
      src.connect(gainNode)
      gainNode.connect(audioDest)
      gainNode.connect(audioCtx.destination)

      // Music track (optional) — use an Audio element to avoid CORS fetch issues
      let musicEl: HTMLAudioElement | null = null
      if (spec.music?.url) {
        musicEl = document.createElement('audio')
        musicEl.crossOrigin = 'anonymous'
        musicEl.src = spec.music.url
        musicEl.loop = true
        await new Promise<void>(r => { musicEl!.oncanplaythrough = () => r(); musicEl!.onerror = () => r(); musicEl!.load() })
        const musicSrc  = audioCtx.createMediaElementSource(musicEl)
        const musicGain = audioCtx.createGain()
        musicGain.gain.value = spec.music.volume ?? 0.5
        musicSrc.connect(musicGain)
        musicGain.connect(audioDest)
        musicGain.connect(audioCtx.destination)
      }

      // MediaRecorder captures canvas + audio
      // Use 60fps capture so fast motion stays sharp; VP9 at 20Mbps for archival quality
      const capStream = canvas.captureStream(60)
      for (const t of audioDest.stream.getAudioTracks()) capStream.addTrack(t)

      const mimeType =
        MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
        MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' :
        'video/webm'

      const recorder = new MediaRecorder(capStream, { mimeType, videoBitsPerSecond: 20_000_000 })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

      // Build filter string once
      const f = spec.filters
      const filterStr = f
        ? [
            f.brightness !== 1 ? `brightness(${f.brightness})` : '',
            f.contrast   !== 1 ? `contrast(${f.contrast})`     : '',
            f.saturation !== 1 ? `saturate(${f.saturation})`   : '',
          ].filter(Boolean).join(' ')
        : ''

      // Seek to trim start
      vid.currentTime = trimStart
      vid.playbackRate = speed
      await new Promise<void>(r => { vid.onseeked = () => r() })

      await audioCtx.resume()  // browser may suspend AudioContext until user interaction
      recorder.start(100)
      setExportStatus('Rendering 0%')
      if (musicEl) { musicEl.currentTime = spec.music?.startOffset ?? 0; await musicEl.play().catch(() => {}) }
      await vid.play()

      await new Promise<void>((resolve, reject) => {
        // Prefer requestVideoFrameCallback (fires per decoded video frame) over
        // rAF (fires per display refresh). rVFC gives us frame-accurate timing
        // — every video frame gets drawn exactly once. rAF drops ticks under
        // load, which is what was causing 15s videos to export as 14s with
        // slower apparent playback.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasRVFC = typeof (vid as any).requestVideoFrameCallback === 'function'

        // CRITICAL: rVFC only fires when a NEW frame is decoded. When the
        // video reaches its natural end (trimEnd == duration), playback
        // stops, no more frames decode, and the tick callback never runs
        // again — so the end-check inside it never fires and the export
        // hangs at 99% forever. Finalize must therefore also be reachable
        // from vid.onended and a watchdog interval, not just from tick.
        let finished = false
        const finalize = () => {
          if (finished) return
          finished = true
          clearInterval(watchdog)
          vid.pause()
          try { recorder.stop() } catch { /* already stopped */ }
          resolve()
        }
        vid.onended = finalize
        const watchdog = setInterval(() => {
          if (vid.ended || vid.currentTime >= trimEnd - 0.05) finalize()
        }, 250)

        const tick = () => {
          if (finished) return
          const t = vid.currentTime
          if (t >= trimEnd || vid.ended) {
            finalize()
            return
          }

          const pct = Math.round(((t - trimStart) / (trimEnd - trimStart)) * 100)
          setExportStatus(`Rendering ${pct}%`)
          setExportProgress(pct)

          // Draw video frame with optional Ken Burns zoom
          ctx.save()
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          if (filterStr) ctx.filter = filterStr
          if (spec.zoom) {
            const progress = (t - trimStart) / (trimEnd - trimStart)
            const scale = spec.zoom.fromScale + (spec.zoom.toScale - spec.zoom.fromScale) * progress
            const px = (spec.zoom.fromX + (spec.zoom.toX - spec.zoom.fromX) * progress) * outW
            const py = (spec.zoom.fromY + (spec.zoom.toY - spec.zoom.fromY) * progress) * outH
            ctx.translate(px, py)
            ctx.scale(scale, scale)
            ctx.translate(-px, -py)
          }
          if (spec.crop) {
            ctx.drawImage(vid, spec.crop.x * outW, spec.crop.y * outH, spec.crop.w * outW, spec.crop.h * outH, 0, 0, outW, outH)
          } else {
            ctx.drawImage(vid, 0, 0, outW, outH)
          }
          ctx.filter = 'none'
          ctx.restore()

          // Fade in / out overlays
          if (spec.fadeIn && t - trimStart < 0.5) {
            ctx.fillStyle = `rgba(0,0,0,${1 - (t - trimStart) / 0.5})`
            ctx.fillRect(0, 0, outW, outH)
          }
          if (spec.fadeOut && trimEnd - t < 0.5) {
            ctx.fillStyle = `rgba(0,0,0,${1 - (trimEnd - t) / 0.5})`
            ctx.fillRect(0, 0, outW, outH)
          }

          // Image overlays
          for (const img of (spec.imageOverlays ?? [])) {
            if (t >= img.start && t < img.start + img.duration) {
              const el = imgEls.get(img.id)
              if (el) {
                ctx.save()
                ctx.globalAlpha = img.opacity ?? 1
                const w = outW * (img.scale ?? 0.3)
                const h = (el.naturalHeight / el.naturalWidth) * w
                ctx.drawImage(el, (img.x ?? 0.5) * outW - w / 2, (img.y ?? 0.5) * outH - h / 2, w, h)
                ctx.restore()
              }
            }
          }

          // Text overlays
          for (const ov of spec.overlays) {
            if (t >= ov.start && t < ov.start + ov.duration) {
              drawTextOnCanvas(ctx, ov, outW, outH, t)
            }
          }

          if (hasRVFC) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (vid as any).requestVideoFrameCallback(tick)
          } else {
            requestAnimationFrame(tick)
          }
        }
        vid.onerror = e => { clearInterval(watchdog); reject(e) }
        if (hasRVFC) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (vid as any).requestVideoFrameCallback(tick)
        } else {
          requestAnimationFrame(tick)
        }
      })

      await new Promise<void>(r => { recorder.onstop = () => r() })
      await audioCtx.close()

      const blob = new Blob(chunks, { type: mimeType })
      exportBlobRef.current = blob
      const url  = URL.createObjectURL(blob)
      const sizeMB = (blob.size / 1024 / 1024).toFixed(1)
      const durSec = (trimEnd - trimStart).toFixed(1)
      setExportUrl(url)
      setExportProgress(100)
      setSavedToLibrary(false)
      setExportStatus(`Done — ${durSec}s · ${sizeMB} MB`)

      // Auto-download
      const a = document.createElement('a')
      a.href = url
      a.download = `contentflow-${Date.now()}.webm`
      a.click()

    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  // Word-wrap a string to fit within maxWidth on the current ctx font settings.
  // Mirrors the preview's CSS wrapping (max-width ≈ 88% of canvas width) so
  // exported captions break where the user sees them wrap in the editor.
  function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const paragraphs = text.split('\n')
    const out: string[] = []
    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(Boolean)
      if (words.length === 0) { out.push(''); continue }
      let line = words[0]
      for (let i = 1; i < words.length; i++) {
        const test = `${line} ${words[i]}`
        if (ctx.measureText(test).width > maxWidth && line) {
          out.push(line)
          line = words[i]
        } else {
          line = test
        }
      }
      out.push(line)
    }
    return out
  }

  function drawTextOnCanvas(ctx: CanvasRenderingContext2D, ov: TextOverlay, outW: number, outH: number, t?: number) {
    ctx.save()
    const sizeMap: Record<string, number> = { sm: 36, md: 48, lg: 64, xl: 86 }
    const fs = sizeMap[ov.fontSize ?? 'md'] ?? 48
    const cx = (ov.x ?? 0.5) * outW
    const cy = ov.y !== undefined ? ov.y * outH
             : ov.position === 'top' ? outH * 0.1
             : ov.position === 'center' ? outH * 0.5
             : outH * 0.85

    // Entrance animation
    if (t !== undefined && ov.animation && ov.animation !== 'none') {
      const elapsed = t - ov.start
      const progress = Math.min(1, elapsed / 0.35)
      if (ov.animation === 'fade') {
        ctx.globalAlpha = progress
      } else if (ov.animation === 'slide-up') {
        ctx.globalAlpha = progress
        ctx.translate(0, (1 - progress) * 40)
      } else if (ov.animation === 'zoom') {
        const s = 0.6 + 0.4 * progress
        ctx.translate(cx, cy)
        ctx.scale(s, s)
        ctx.translate(-cx, -cy)
        ctx.globalAlpha = progress
      } else if (ov.animation === 'typewriter') {
        const chars = Math.floor(progress * ov.text.length)
        ov = { ...ov, text: ov.text.slice(0, chars) }
      }
    }

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    const fontFamilyMap: Record<string, string> = {
      sans:    'Inter,Arial,sans-serif',
      rounded: 'Nunito,"Varela Round",Arial,sans-serif',
      mono:    '"Courier New",Courier,monospace',
      serif:   'Georgia,"Times New Roman",serif',
    }
    const ff = fontFamilyMap[ov.fontFamily ?? 'sans'] ?? 'Inter,Arial,sans-serif'
    ctx.font = `700 ${fs}px ${ff}`

    const style = ov.style ?? 'caption'
    const displayText = style === 'tiktok' ? ov.text.toUpperCase() : ov.text

    // Set the style-appropriate font BEFORE measuring so wrapping matches
    // what will actually be drawn.
    if (style === 'bold-white')      ctx.font = `800 ${fs}px Montserrat,${ff}`
    else if (style === 'minimal')    ctx.font = `400 ${fs}px ${ff}`
    else if (style === 'tiktok')     ctx.font = `900 ${fs}px "Montserrat","Arial Black",sans-serif`
    else if (style === 'outline')    ctx.font = `800 ${fs}px Montserrat,${ff}`
    else                              ctx.font = `700 ${fs}px ${ff}`

    // Mirror the preview's max-width: 88% of the canvas width. Then wrap.
    const maxW = outW * 0.88
    const lines = wrapCanvasText(ctx, displayText, maxW)
    const lineHeight = fs * 1.2
    const blockHeight = lineHeight * lines.length
    const startY = cy - blockHeight / 2 + lineHeight / 2

    // Draw one line's rendering; y is the baseline center for that line.
    const drawLine = (text: string, y: number) => {
      if (style === 'bold-white') {
        ctx.fillStyle   = ov.color ?? '#ffffff'
        ctx.shadowColor = 'rgba(0,0,0,0.85)'
        ctx.shadowBlur  = 10
        ctx.fillText(text, cx, y)
        ctx.shadowBlur  = 0
      } else if (style === 'minimal') {
        ctx.fillStyle = ov.color ?? '#ffffff'
        ctx.fillText(text, cx, y)
      } else if (style === 'tiktok') {
        ctx.lineJoin    = 'round'
        ctx.strokeStyle = ov.strokeColor ?? '#000000'
        ctx.lineWidth   = fs * 0.16
        ctx.strokeText(text, cx, y)
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur  = fs * 0.3
        ctx.fillStyle   = ov.color ?? '#ffffff'
        ctx.fillText(text, cx, y)
        ctx.shadowBlur  = 0
      } else if (style === 'outline') {
        ctx.strokeStyle = ov.strokeColor ?? '#ffffff'
        ctx.lineWidth   = fs * 0.08
        ctx.lineJoin    = 'round'
        ctx.strokeText(text, cx, y)
        ctx.fillStyle = ov.color ?? '#FFE14D'
        ctx.fillText(text, cx, y)
      } else if (style === 'highlight') {
        const tw = ctx.measureText(text).width
        ctx.fillStyle = ov.bgColor ?? '#FFE14D'
        // @ts-ignore
        ctx.roundRect?.(cx - tw / 2 - 16, y - fs / 2 - 10, tw + 32, fs + 20, 10)
        ctx.fill()
        ctx.fillStyle = ov.color ?? '#000000'
        ctx.fillText(text, cx, y)
      } else if (style === 'bubble') {
        const tw = ctx.measureText(text).width
        const bw = tw + 44, bh = fs + 28
        const bx = cx - bw / 2, by = y - bh / 2
        ctx.shadowColor = 'rgba(0,0,0,0.28)'
        ctx.shadowBlur  = 20
        ctx.fillStyle   = ov.bgColor ?? '#ffffff'
        // @ts-ignore
        ctx.roundRect?.(bx, by, bw, bh, bh / 2)
        ctx.fill()
        ctx.shadowBlur  = 0
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth   = 2
        // @ts-ignore
        ctx.roundRect?.(bx, by, bw, bh, bh / 2)
        ctx.stroke()
        ctx.fillStyle   = ov.color ?? '#1a1a17'
        ctx.fillText(text, cx, y)
      } else {
        // default caption: measure widest line for the background pill
        const tw = ctx.measureText(text).width
        ctx.fillStyle = ov.bgColor ?? 'rgba(0,0,0,0.55)'
        ctx.beginPath()
        // @ts-ignore
        ctx.roundRect?.(cx - tw / 2 - 14, y - fs / 2 - 8, tw + 28, fs + 16, 8)
        ctx.fill()
        ctx.fillStyle = ov.color ?? '#ffffff'
        ctx.fillText(text, cx, y)
      }
    }

    if (style === 'minimal') {
      ctx.globalAlpha = (ctx.globalAlpha ?? 1) * 0.9
    }

    for (let i = 0; i < lines.length; i++) {
      drawLine(lines[i], startY + i * lineHeight)
    }

    ctx.restore()
  }

  async function handleAiEdit() {
    // Caption/subtitle requests need real Whisper transcription, not Claude guessing
    if (/caption|subtitle|transcri/i.test(aiInput)) {
      setAiInput('')
      await handleAutoCaption()
      return
    }
    setAiLoading(true)
    try {
      const supabase = getSupabase()
      const { data: session } = await supabase!.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch('/api/video/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spec, instruction: aiInput }),
      })
      const { spec: newSpec, error } = await res.json()
      if (error) throw new Error(error)
      pushHistory(newSpec)
      setAiInput('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'AI edit failed')
    } finally {
      setAiLoading(false)
    }
  }

  function addOverlay() {
    if (!newText.trim()) return
    const defaultY = newPosition === 'top' ? 0.12 : newPosition === 'center' ? 0.5 : 0.82
    pushHistory({
      ...spec,
      overlays: [...spec.overlays, {
        id: genId(),
        text: newText.trim(),
        start: newStart,
        duration: newDuration,
        position: newPosition,
        style: newStyle,
        x: 0.5,
        y: defaultY,
        color: newColor,
        fontSize: newFontSize,
        animation: newAnimation ?? 'none',
      }],
    })
    setNewText('')
  }

  function addEmojiSticker(emoji: string) {
    pushHistory({
      ...spec,
      overlays: [...spec.overlays, {
        id: genId(),
        text: emoji,
        start: currentTime,
        duration: 2,
        position: 'center',
        style: 'bold-white',
        x: 0.5,
        y: 0.5,
        fontSize: 'xl',
      }],
    })
  }

  function splitAtPlayhead() {
    if (!spec.videoUrl || currentTime <= spec.trimStart || currentTime >= spec.trimEnd) return
    const keep = confirm(`Trim to:\n• Before: keep 0s – ${fmt(currentTime)}\n• After: keep ${fmt(currentTime)} – end\n\nClick OK for "Before", Cancel for "After"`)
    if (keep) {
      pushHistory({ ...spec, trimEnd: currentTime })
    } else {
      pushHistory({ ...spec, trimStart: currentTime })
    }
    if (videoRef.current) videoRef.current.currentTime = keep ? spec.trimStart : currentTime
  }

  function applyCaptionStyleToAll(style: TextOverlay['style']) {
    setActiveCaptionStyle(style)
    pushHistory({
      ...spec,
      overlays: spec.overlays.map(o => ({ ...o, style })),
    })
  }

  async function handleAutoCaption() {
    console.log('[caption] handleAutoCaption start', { videoUrl: spec.videoUrl?.slice(0, 80), duration: spec.duration })
    if (!spec.videoUrl) { console.log('[caption] no videoUrl, returning'); return }
    setCaptionLoading(true)
    setCaptionError(null)
    try {
      console.log('[caption] getting supabase session')
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase client not available')
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      console.log('[caption] token present:', !!token)
      if (!token) throw new Error('Not signed in')

      let videoUrl = spec.videoUrl

      // For local blob videos, upload directly to Supabase first to bypass
      // Vercel's 4.5 MB body limit before sending URL to the transcribe endpoint
      if (spec.videoUrl.startsWith('blob:')) {
        // Prefer the stored File object — fetching a blob URL can be blocked by
        // some browser extensions, and the original File is always reliable
        let blob: Blob
        if (uploadedFileRef.current) {
          console.log('[caption] using stored File object, size:', uploadedFileRef.current.size)
          blob = uploadedFileRef.current
        } else {
          console.log('[caption] no stored File, fetching blob URL')
          blob = await fetch(spec.videoUrl).then(r => r.blob())
        }
        console.log('[caption] blob ready, size:', blob.size, 'type:', blob.type)
        const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mov') ? 'mov' : 'mp4'

        console.log('[caption] requesting signed upload URL')
        const urlRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ folder: 'editor-transcribe', ext }),
        })
        console.log('[caption] upload-url status:', urlRes.status)
        const { signedUrl, storagePath, error: urlErr } = await urlRes.json()
        if (urlErr) throw new Error(`Upload URL error: ${urlErr}`)
        if (!signedUrl) throw new Error('No signed URL returned')

        console.log('[caption] uploading to Supabase, path:', storagePath)
        const putRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': blob.type || 'video/mp4' },
          body: blob,
        })
        console.log('[caption] supabase PUT status:', putRes.status)
        if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)

        const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(storagePath)
        videoUrl = publicUrl
        console.log('[caption] public URL:', publicUrl)
      }

      // Start the Replicate job (fast — returns predictionId immediately)
      const startRes = await fetch('/api/video/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoUrl, language: captionLanguage === 'auto' ? undefined : captionLanguage }),
      })
      const startData = await startRes.json()
      if (startData.error) throw new Error(startData.error)
      const { predictionId } = startData

      // Poll from the browser until done (avoids Vercel function timeout)
      const deadline = Date.now() + 120_000
      let overlays: unknown[] = []
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000))
        const pollRes = await fetch(
          `/api/video/transcribe?predictionId=${predictionId}&duration=${spec.duration}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        const pollData = await pollRes.json()
        if (pollData.error) throw new Error(pollData.error)
        if (pollData.status === 'done') {
          overlays = pollData.overlays ?? []
          break
        }
      }
      if (!overlays.length && Date.now() >= deadline) throw new Error('Transcription timed out')
      pushHistory({ ...spec, overlays: [...spec.overlays, ...(overlays as typeof spec.overlays)] })
    } catch (e) {
      console.error('[caption] FAILED:', e)
      setCaptionError(e instanceof Error ? e.message : 'Caption failed')
    } finally {
      setCaptionLoading(false)
    }
  }

  function addImageOverlay(src: string) {
    pushHistory({
      ...spec,
      imageOverlays: [...(spec.imageOverlays ?? []), {
        id: genId(),
        src,
        start: imgStart,
        duration: imgDuration,
        x: 0.5,
        y: 0.5,
        scale: imgScale,
        opacity: imgOpacity,
      }],
    })
    setImgUrl('')
  }

  function handleImgFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    addImageOverlay(url)
    e.target.value = ''
  }

  function startImgDrag(e: React.MouseEvent, imgId: string) {
    e.preventDefault()
    e.stopPropagation()
    const img = (spec.imageOverlays ?? []).find(o => o.id === imgId)
    if (!img) return
    setSelectedImgId(imgId)
    draggingImg.current = { id: imgId, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y }
    const rect = videoWrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const specSnapshot = { ...spec, imageOverlays: [...(spec.imageOverlays ?? [])] }
    function onMove(me: MouseEvent) {
      if (!draggingImg.current || !rect) return
      const { id, startX, startY, origX, origY } = draggingImg.current
      const dx = (me.clientX - startX) / rect.width
      const dy = (me.clientY - startY) / rect.height
      const nx = Math.max(0, Math.min(1, origX + dx))
      const ny = Math.max(0, Math.min(1, origY + dy))
      setSpec(s => ({ ...s, imageOverlays: (s.imageOverlays ?? []).map(o => o.id === id ? { ...o, x: nx, y: ny } : o) }))
    }
    function onUp(me: MouseEvent) {
      if (!draggingImg.current || !rect) { draggingImg.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); return }
      const { id, startX, startY, origX, origY } = draggingImg.current
      const dx = (me.clientX - startX) / rect.width
      const dy = (me.clientY - startY) / rect.height
      const nx = Math.max(0, Math.min(1, origX + dx))
      const ny = Math.max(0, Math.min(1, origY + dy))
      pushHistory({ ...specSnapshot, imageOverlays: specSnapshot.imageOverlays.map(o => o.id === id ? { ...o, x: nx, y: ny } : o) })
      draggingImg.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startOverlayDrag(e: React.MouseEvent, overlayId: string) {
    e.preventDefault()
    e.stopPropagation()
    const overlay = spec.overlays.find(o => o.id === overlayId)
    if (!overlay) return
    setSelectedOverlayId(overlayId)
    draggingOverlay.current = {
      id: overlayId,
      startX: e.clientX,
      startY: e.clientY,
      origX: overlay.x ?? 0.5,
      origY: overlay.y ?? 0.5,
    }
    const rect = videoWrapRef.current?.getBoundingClientRect()
    if (!rect) return

    // Snapshot spec for drag so we push one history entry on mouseup
    const specSnapshot = { ...spec }

    function onMove(me: MouseEvent) {
      if (!draggingOverlay.current || !rect) return
      const { id, startX, startY, origX, origY } = draggingOverlay.current
      const dx = (me.clientX - startX) / rect.width
      const dy = (me.clientY - startY) / rect.height
      const newX = Math.max(0, Math.min(1, origX + dx))
      const newY = Math.max(0, Math.min(1, origY + dy))
      setSpec(s => ({
        ...s,
        overlays: s.overlays.map(o => o.id === id ? { ...o, x: newX, y: newY } : o),
      }))
    }
    function onUp(me: MouseEvent) {
      if (!draggingOverlay.current || !rect) { draggingOverlay.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); return }
      const { id, startX, startY, origX, origY } = draggingOverlay.current
      const dx = (me.clientX - startX) / rect.width
      const dy = (me.clientY - startY) / rect.height
      const newX = Math.max(0, Math.min(1, origX + dx))
      const newY = Math.max(0, Math.min(1, origY + dy))
      const finalSpec = {
        ...specSnapshot,
        overlays: specSnapshot.overlays.map(o => o.id === id ? { ...o, x: newX, y: newY } : o),
      }
      pushHistory(finalSpec)
      draggingOverlay.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function skip(delta: number) {
    if (!videoRef.current) return
    const t = Math.max(0, Math.min(spec.duration, videoRef.current.currentTime + delta))
    videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  const trimPct = spec.duration > 0 ? {
    start: (spec.trimStart / spec.duration) * 100,
    end: (spec.trimEnd / spec.duration) * 100,
    cursor: (currentTime / spec.duration) * 100,
  } : { start: 0, end: 100, cursor: 0 }

  const aspectStyle = spec.aspectRatio === '9:16' ? '9/16' : spec.aspectRatio === '1:1' ? '1/1' : '16/9'

  const currentFilters = spec.filters ?? DEFAULT_FILTERS
  const videoFilterStyle = `brightness(${currentFilters.brightness}) contrast(${currentFilters.contrast}) saturate(${currentFilters.saturation})`

  // ── styles ────────────────────────────────────────────────────────────────
  const S = {
    root: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: 'calc(100vh - 60px)',
      background: 'var(--surface-2)',
      color: 'var(--ink)',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden',
    },
    topBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 20px',
      height: 52,
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      flexShrink: 0,
    },
    title: { fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginRight: 'auto' },
    arBtn: (active: boolean) => ({
      padding: '4px 10px',
      fontSize: 12,
      fontWeight: 500,
      borderRadius: 6,
      border: '1px solid',
      borderColor: active ? 'var(--ink)' : 'var(--border)',
      background: active ? 'var(--ink)' : 'transparent',
      color: active ? 'var(--surface)' : 'var(--ink-mute)',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }),
    undoRedoBtn: (disabled: boolean) => ({
      width: 32,
      height: 32,
      borderRadius: 6,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      color: disabled ? 'var(--ink-mute)' : 'var(--ink)',
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      opacity: disabled ? 0.4 : 1,
      transition: 'opacity 0.15s',
    }),
    uploadBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      fontSize: 13,
      fontWeight: 600,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      cursor: 'pointer',
      transition: 'background 0.15s',
    },
    exportTopBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 16px',
      fontSize: 13,
      fontWeight: 700,
      borderRadius: 8,
      border: 'none',
      background: 'var(--ink)',
      color: 'var(--surface)',
      cursor: 'pointer',
    },
    body: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
    },
    // ── Preview area ──────────────────────────────────────────────────────
    previewArea: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 16,
      background: 'var(--surface-3)',
      overflow: 'hidden',
    },
    videoWrap: {
      position: 'relative' as const,
      background: '#000',
      borderRadius: 12,
      overflow: 'hidden',
      aspectRatio: aspectStyle,
      maxHeight: 'calc(100vh - 280px)',
      maxWidth: '100%',
      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
    },
    emptyState: {
      width: '100%',
      height: '100%',
      minHeight: 240,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      cursor: 'pointer',
      border: '2px dashed var(--border-strong)',
      borderRadius: 12,
    },
    controls: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      maxWidth: 600,
    },
    ctrlBtn: (primary?: boolean) => ({
      width: primary ? 44 : 36,
      height: primary ? 44 : 36,
      borderRadius: '50%',
      border: '1px solid',
      borderColor: primary ? 'var(--ink)' : 'var(--border)',
      background: primary ? 'var(--ink)' : 'var(--surface)',
      color: primary ? 'var(--surface)' : 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: primary ? 18 : 14,
      flexShrink: 0,
      transition: 'background 0.15s',
    }),
    timeLabel: {
      fontSize: 13,
      fontVariantNumeric: 'tabular-nums' as const,
      color: 'var(--ink-mute)',
      marginLeft: 4,
    },
    // ── Timeline ──────────────────────────────────────────────────────────
    timelineWrap: {
      width: '100%',
      maxWidth: 600,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
    },
    timelineTrack: {
      position: 'relative' as const,
      height: 90,
      background: 'var(--surface)',
      borderRadius: 8,
      overflow: 'visible',
      cursor: 'crosshair',
      border: '1px solid var(--border)',
    },
    // ── Right panel ───────────────────────────────────────────────────────
    rightPanel: {
      width: 320,
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
    },
    tabRow: {
      display: 'flex',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      overflowX: 'auto' as const,
    },
    tab: (active: boolean) => ({
      flex: 1,
      padding: '14px 0 12px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: 3,
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      color: active ? 'var(--ink)' : 'var(--ink-mute)',
      cursor: 'pointer',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
      transition: 'color 0.15s',
    }),
    tabIcon: { fontSize: 14 },
    panelBody: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: 20,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 16,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: 'var(--ink-mute)',
      marginBottom: 8,
    },
    fieldLabel: {
      fontSize: 12,
      color: 'var(--ink-dim)',
      marginBottom: 5,
      display: 'block',
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--surface-2)',
      color: 'var(--ink)',
      fontSize: 13,
      boxSizing: 'border-box' as const,
      outline: 'none',
    },
    select: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--surface-2)',
      color: 'var(--ink)',
      fontSize: 13,
      boxSizing: 'border-box' as const,
      outline: 'none',
    },
    sliderWrap: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
    },
    primaryBtn: {
      width: '100%',
      padding: '10px',
      borderRadius: 8,
      border: 'none',
      background: 'var(--ink)',
      color: 'var(--surface)',
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'opacity 0.15s',
    },
    ghostBtn: {
      width: '100%',
      padding: '9px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--ink-dim)',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    },
    overlayCard: {
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--surface-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    musicCard: (active: boolean) => ({
      padding: '12px 14px',
      borderRadius: 8,
      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      transition: 'all 0.15s',
    }),
    summaryRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      padding: '6px 0',
      borderBottom: '1px solid var(--border)',
      color: 'var(--ink-dim)',
    },
    chipBtn: (active: boolean) => ({
      flex: 1,
      padding: '6px 4px',
      borderRadius: 6,
      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
      background: active ? 'var(--ink)' : 'var(--surface-2)',
      color: active ? 'var(--surface)' : 'var(--ink-dim)',
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
      textAlign: 'center' as const,
      transition: 'all 0.15s',
    }),
    pillBtn: (active: boolean) => ({
      padding: '5px 10px',
      borderRadius: 20,
      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
      background: active ? 'var(--ink)' : 'transparent',
      color: active ? 'var(--surface)' : 'var(--ink-dim)',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.15s',
    }),
    toggleCard: (active: boolean) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: 8,
      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }),
  }

  return (
    <div style={S.root}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={S.topBar}>
        <span style={S.title}>
          <span style={{ color: 'var(--ink)', marginRight: 8 }}>▶</span>
          Video Editor
        </span>

        {/* Undo / Redo */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            style={S.undoRedoBtn(historyIndex.current <= 0)}
            onClick={undo}
            title="Undo (Cmd+Z)"
            disabled={historyIndex.current <= 0}
          >←</button>
          <button
            style={S.undoRedoBtn(historyIndex.current >= history.current.length - 1)}
            onClick={redo}
            title="Redo (Cmd+Shift+Z)"
            disabled={historyIndex.current >= history.current.length - 1}
          >→</button>
        </div>

        {/* Aspect ratio */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['9:16', '1:1', '16:9'] as const).map(ar => (
            <button key={ar} onClick={() => pushHistory({ ...spec, aspectRatio: ar })} style={S.arBtn(spec.aspectRatio === ar)}>
              {ar}
            </button>
          ))}
        </div>

        {/* Upload */}
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileInput} style={{ display: 'none' }} />
        <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgFileInput} style={{ display: 'none' }} />
        <input ref={musicInputRef} type="file" accept="audio/*" onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          const url = URL.createObjectURL(file)
          pushHistory({ ...spec, music: { url, label: file.name.replace(/\.[^.]+$/, ''), volume: 0.5 } })
          e.target.value = ''
        }} style={{ display: 'none' }} />
        <button style={S.uploadBtn} onClick={() => fileInputRef.current?.click()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload Video
        </button>

        {/* Quick export */}
        <button style={S.exportTopBtn} onClick={() => setActivePanel('export')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={S.body}>

        {/* ── Preview ────────────────────────────────────────────────────── */}
        <div
          style={S.previewArea}
          onDragOver={e => { e.preventDefault(); setIsDraggingFile(true) }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
        >
          {/* Video / empty state */}
          {spec.videoUrl ? (
            <div ref={videoWrapRef} onClick={() => setSelectedOverlayId(null)} style={{ ...S.videoWrap, outline: isDraggingFile ? '2px dashed var(--ink)' : 'none' }}>
              <video
                ref={videoRef}
                src={spec.videoUrl}
                muted={isMuted}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: spec.crop ? 'cover' : 'contain',
                  objectPosition: spec.crop ? `${spec.crop.x * 100}% ${spec.crop.y * 100}%` : 'center',
                  display: 'block',
                  filter: videoFilterStyle,
                  transform: (() => {
                    if (!spec.zoom) return undefined
                    const progress = spec.duration > 0 ? currentTime / spec.duration : 0
                    const scale = spec.zoom.fromScale + (spec.zoom.toScale - spec.zoom.fromScale) * progress
                    const tx = (spec.zoom.fromX + (spec.zoom.toX - spec.zoom.fromX) * progress - 0.5) * 100
                    const ty = (spec.zoom.fromY + (spec.zoom.toY - spec.zoom.fromY) * progress - 0.5) * 100
                    return `scale(${scale}) translate(${tx}%, ${ty}%)`
                  })(),
                  transition: 'transform 0.05s linear',
                }}
                onTimeUpdate={e => {
                  if (isDraggingPlayhead.current) return  // don't override drag position
                  const vid = e.currentTarget
                  const tStart = spec.trimStart ?? 0
                  const tEnd   = spec.trimEnd > 0 ? spec.trimEnd : spec.duration
                  if (vid.currentTime < tStart) { vid.currentTime = tStart }
                  else if (vid.currentTime >= tEnd) {
                    vid.pause(); vid.currentTime = tStart
                    const m = musicPreviewRef.current; if (m) { m.pause(); m.currentTime = 0 }
                  }
                  setCurrentTime(vid.currentTime)
                }}
                onPlay={() => {
                  setIsPlaying(true)
                  const m = musicPreviewRef.current
                  if (m && spec.music?.url) { m.currentTime = spec.music.startOffset ?? 0; m.play().catch(() => {}) }
                }}
                onPause={() => {
                  setIsPlaying(false)
                  musicPreviewRef.current?.pause()
                }}
                onSeeked={e => {
                  // Sync music position when user scrubs
                  const m = musicPreviewRef.current
                  if (m && spec.music?.url) m.currentTime = e.currentTarget.currentTime
                }}
                onLoadedMetadata={e => {
                  const d = e.currentTarget.duration
                  e.currentTarget.playbackRate = spec.speed ?? 1
                  e.currentTarget.volume = spec.volume ?? 1
                  setSpec(s => ({ ...s, duration: d, trimEnd: s.trimEnd === 0 ? d : s.trimEnd }))
                }}
              />
              {/* Hidden music preview audio element */}
              <audio ref={musicPreviewRef} loop style={{ display: 'none' }} />

              {/* Fade in/out overlay */}
              {(spec.fadeIn || spec.fadeOut) && (() => {
                const tStart = spec.trimStart ?? 0
                const tEnd   = spec.trimEnd > 0 ? spec.trimEnd : spec.duration
                let opacity = 0
                if (spec.fadeIn && currentTime - tStart < 0.5) opacity = 1 - (currentTime - tStart) / 0.5
                if (spec.fadeOut && tEnd - currentTime < 0.5) opacity = Math.max(opacity, 1 - (tEnd - currentTime) / 0.5)
                return opacity > 0 ? (
                  <div style={{ position: 'absolute', inset: 0, background: 'black', opacity, pointerEvents: 'none', borderRadius: 'inherit' }} />
                ) : null
              })()}

              {/* Text overlay previews — draggable */}
              {spec.overlays.map(o => {
                const visible = currentTime >= o.start && currentTime < o.start + o.duration
                const isSelected = selectedOverlayId === o.id
                const xPct = (o.x ?? 0.5) * 100
                const yPct = (o.y ?? (o.position === 'top' ? 0.12 : o.position === 'center' ? 0.5 : 0.82)) * 100
                const fs = o.fontSize === 'sm' ? 13 : o.fontSize === 'lg' ? 22 : o.fontSize === 'xl' ? 28 : 18

                // Entrance animation CSS
                const elapsed = currentTime - o.start
                const prog = visible ? Math.min(1, elapsed / 0.35) : 1
                let animStyle: React.CSSProperties = {}
                if (visible && o.animation && o.animation !== 'none') {
                  if (o.animation === 'fade') animStyle = { opacity: prog }
                  else if (o.animation === 'slide-up') animStyle = { opacity: prog, transform: `translate(-50%, calc(-50% + ${(1 - prog) * 20}px))` }
                  else if (o.animation === 'zoom') animStyle = { opacity: prog, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * prog})` }
                }

                // Style-specific appearance
                const fontFamilyCss = FONT_FAMILIES.find(f => f.id === o.fontFamily)?.css ?? 'Inter,Arial,sans-serif'
                const styleMap: Record<string, React.CSSProperties> = {
                  'bold-white': { color: o.color ?? '#fff', fontWeight: 900, textShadow: '0 2px 12px rgba(0,0,0,0.9)', background: 'none', fontFamily: fontFamilyCss },
                  'minimal':    { color: o.color ?? '#fff', fontWeight: 400, opacity: 0.9, background: 'none', fontFamily: fontFamilyCss },
                  'caption':    { color: o.color ?? '#fff', fontWeight: 700, background: o.bgColor ?? 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 6, fontFamily: fontFamilyCss },
                  'tiktok':     { color: o.color ?? '#fff', fontWeight: 900, WebkitTextStroke: `${fs * 0.14}px ${o.strokeColor ?? '#000'}`, textShadow: `0 0 ${fs * 0.3}px rgba(0,0,0,0.5)`, background: 'none', letterSpacing: '0.03em', textTransform: 'uppercase' as const, fontFamily: '"Montserrat","Arial Black",sans-serif' },
                  'outline':    { color: o.color ?? '#FFE14D', fontWeight: 800, WebkitTextStroke: `${fs * 0.06}px ${o.strokeColor ?? '#fff'}`, background: 'none', fontFamily: fontFamilyCss },
                  'highlight':  { color: o.color ?? '#000', fontWeight: 700, background: o.bgColor ?? '#FFE14D', padding: '5px 14px', borderRadius: 10, fontFamily: fontFamilyCss },
                  'bubble':     { color: o.color ?? '#1a1a17', fontWeight: 700, background: o.bgColor ?? '#ffffff', padding: '8px 20px', borderRadius: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12)', border: '2px solid rgba(255,255,255,0.9)', fontFamily: o.fontFamily === 'rounded' ? '"Nunito","Varela Round",Arial,sans-serif' : fontFamilyCss },
                }
                const appearanceStyle = styleMap[o.style ?? 'caption'] ?? styleMap.caption

                return (
                  <div
                    key={o.id}
                    onMouseDown={e => startOverlayDrag(e, o.id)}
                    onClick={e => { e.stopPropagation(); setSelectedOverlayId(o.id) }}
                    style={{
                      position: 'absolute',
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      fontSize: fs,
                      cursor: 'grab',
                      userSelect: 'none',
                      opacity: visible || isSelected ? (animStyle.opacity ?? 1) : 0,
                      pointerEvents: visible || isSelected ? 'auto' : 'none',
                      outline: isSelected ? '1.5px dashed var(--ink)' : 'none',
                      outlineOffset: 4,
                      whiteSpace: 'normal',
                      maxWidth: '88%',
                      wordBreak: 'break-word',
                      zIndex: 10,
                      transition: 'opacity 0.1s',
                      ...appearanceStyle,
                      ...(animStyle.transform ? { transform: animStyle.transform } : {}),
                    }}
                  >
                    {o.animation === 'typewriter' && visible
                      ? o.text.slice(0, Math.floor(prog * o.text.length))
                      : o.text}
                    {isSelected && (
                      <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'var(--surface)', background: 'rgba(26,26,23,0.75)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                        drag to reposition
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Image overlay previews — draggable */}
              {(spec.imageOverlays ?? []).map(o => {
                const visible = currentTime >= o.start && currentTime < o.start + o.duration
                const isSelected = selectedImgId === o.id
                return (
                  <img
                    key={o.id}
                    src={o.src}
                    alt=""
                    onMouseDown={e => startImgDrag(e, o.id)}
                    onClick={e => { e.stopPropagation(); setSelectedImgId(o.id) }}
                    style={{
                      position: 'absolute',
                      left: `${o.x * 100}%`,
                      top: `${o.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      width: `${o.scale * 100}%`,
                      height: 'auto',
                      opacity: visible ? o.opacity : o.opacity * 0.25,
                      cursor: 'grab',
                      userSelect: 'none',
                      outline: isSelected ? '1.5px dashed var(--ink)' : 'none',
                      outlineOffset: 3,
                      borderRadius: 4,
                      zIndex: 11,
                      pointerEvents: 'auto',
                    }}
                    draggable={false}
                  />
                )
              })}
            </div>
          ) : (
            <div
              style={{ ...S.emptyState, borderColor: isDraggingFile ? 'var(--ink)' : 'var(--border-strong)', background: isDraggingFile ? 'var(--accent-soft)' : 'transparent' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-dim)' }}>Drop a video or click to upload</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>MP4, MOV, WebM</div>
            </div>
          )}

          {/* Playback controls */}
          {spec.videoUrl && (
            <div style={S.controls}>
              <button style={S.ctrlBtn()} onClick={() => skip(-5)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="9" y="15.5" fontSize="6" fill="currentColor">5</text></svg>
              </button>
              <button
                style={S.ctrlBtn(true)}
                onClick={() => videoRef.current?.[isPlaying ? 'pause' : 'play']()}
              >
                {isPlaying
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}><polygon points="5,3 19,12 5,21"/></svg>
                }
              </button>
              <button style={S.ctrlBtn()} onClick={() => skip(5)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
              </button>
              <span style={S.timeLabel}>{fmt(currentTime)} / {fmt(spec.duration)}</span>
              <div style={{ flex: 1 }} />
              <button
                title="Split at playhead"
                onClick={splitAtPlayhead}
                style={{ ...S.ctrlBtn(), fontSize: 13, padding: '0 8px', gap: 4, display: 'flex', alignItems: 'center' }}
              >
                ✂
              </button>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 600 }}>
                {(spec.trimEnd - spec.trimStart).toFixed(1)}s
              </span>
            </div>
          )}

          {/* Timeline */}
          {spec.videoUrl && spec.duration > 0 && (
            <div style={S.timelineWrap}>
              {/* Scrubber row */}
              <div style={{ position: 'relative' }}>
                {/* Time ruler tick marks */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <span key={i} style={{ fontSize: 10, color: 'var(--ink-mute)', fontVariantNumeric: 'tabular-nums' }}>
                      {((spec.duration / 6) * i).toFixed(0)}s
                    </span>
                  ))}
                </div>

                {/* Main timeline track */}
                <div
                  ref={timelineRef}
                  data-timeline
                  style={S.timelineTrack}
                  onClick={e => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const pct = (e.clientX - rect.left) / rect.width
                    const raw = pct * spec.duration
                    const tStart = spec.trimStart ?? 0
                    const tEnd   = spec.trimEnd > 0 ? spec.trimEnd : spec.duration
                    const t = Math.max(tStart, Math.min(tEnd, raw))
                    setCurrentTime(t)
                    if (videoRef.current) videoRef.current.currentTime = t
                  }}
                >
                  {/* Clip fill — pointerEvents none so blocks above can receive events */}
                  <div style={{
                    position: 'absolute',
                    left: 0, top: 0, right: 0, bottom: 0,
                    background: 'repeating-linear-gradient(90deg, var(--surface-2), var(--surface-2) 1px, var(--surface-3) 1px, var(--surface-3) 40px)',
                    borderRadius: 8,
                    pointerEvents: 'none',
                  }} />

                  {/* Trim zone */}
                  <div style={{
                    position: 'absolute',
                    left: `${trimPct.start}%`,
                    width: `${trimPct.end - trimPct.start}%`,
                    top: 0, bottom: 0,
                    background: 'rgba(26,26,23,0.12)',
                    borderTop: '2px solid var(--ink)',
                    borderBottom: '2px solid var(--ink)',
                    pointerEvents: 'none',
                  }} />

                  {/* Trim handles */}
                  <div
                    style={{ position: 'absolute', left: `${trimPct.start}%`, top: 0, bottom: 0, width: 14, background: 'var(--ink)', borderRadius: '4px 0 0 4px', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateX(-7px)', zIndex: 25 }}
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault()
                      isDraggingTrim.current = 'start'
                      const rect = timelineRef.current!.getBoundingClientRect()
                      const onMove = (me: MouseEvent) => {
                        const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
                        const t = pct * spec.duration
                        setSpec(s => ({ ...s, trimStart: Math.min(t, s.trimEnd - 0.1) }))
                      }
                      const onUp = () => { isDraggingTrim.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                    }}
                  >
                    <svg width="4" height="16" viewBox="0 0 4 16" fill="none"><rect x="0.5" y="0" width="1" height="16" rx="0.5" fill="white" opacity="0.7"/><rect x="2.5" y="0" width="1" height="16" rx="0.5" fill="white" opacity="0.7"/></svg>
                  </div>
                  <div
                    style={{ position: 'absolute', left: `${trimPct.end}%`, top: 0, bottom: 0, width: 14, background: 'var(--ink)', borderRadius: '0 4px 4px 0', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateX(-7px)', zIndex: 25 }}
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault()
                      const rect = timelineRef.current!.getBoundingClientRect()
                      const onMove = (me: MouseEvent) => {
                        const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
                        const t = pct * spec.duration
                        setSpec(s => ({ ...s, trimEnd: Math.max(t, s.trimStart + 0.1) }))
                      }
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                    }}
                  >
                    <svg width="4" height="16" viewBox="0 0 4 16" fill="none"><rect x="0.5" y="0" width="1" height="16" rx="0.5" fill="white" opacity="0.7"/><rect x="2.5" y="0" width="1" height="16" rx="0.5" fill="white" opacity="0.7"/></svg>
                  </div>

                  {/* Playhead (draggable) */}
                  <div
                    style={{ position: 'absolute', left: `${trimPct.cursor}%`, top: -6, bottom: -6, width: 16, transform: 'translateX(-7px)', cursor: 'ew-resize', zIndex: 30, display: 'flex', justifyContent: 'center' }}
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault()
                      isDraggingPlayhead.current = true
                      let lastT = currentTime
                      const rect = timelineRef.current!.getBoundingClientRect()
                      const onMove = (me: MouseEvent) => {
                        const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
                        const t = Math.max(spec.trimStart, Math.min(spec.trimEnd > 0 ? spec.trimEnd : spec.duration, pct * spec.duration))
                        lastT = t; setCurrentTime(t)
                      }
                      const onUp = () => {
                        isDraggingPlayhead.current = false
                        if (videoRef.current) videoRef.current.currentTime = lastT
                        window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#e84040', left: '50%', transform: 'translateX(-50%)' }} />
                    <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, background: '#e84040', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #e84040' }} />
                  </div>

                  {/* Music block — top row, draggable to shift audio start */}
                  {spec.music && (
                    <div
                      style={{ position: 'absolute', left: `${(spec.trimStart / spec.duration) * 100}%`, width: `${((spec.trimEnd - spec.trimStart) / spec.duration) * 100}%`, top: 6, height: 22, background: 'rgba(139,92,246,0.85)', borderRadius: 5, cursor: 'grab', display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden', userSelect: 'none', zIndex: 5, gap: 5 }}
                      onMouseDown={e => {
                        e.stopPropagation(); e.preventDefault()
                        const rect = timelineRef.current!.getBoundingClientRect()
                        const startX = e.clientX
                        const origOffset = spec.music!.startOffset ?? 0
                        const onMove = (me: MouseEvent) => {
                          const dx = (me.clientX - startX) / rect.width * spec.duration
                          const newOffset = Math.max(0, origOffset - dx)
                          setSpec(s => s.music ? { ...s, music: { ...s.music!, startOffset: newOffset } } : s)
                        }
                        const onUp = () => { setActivePanel('music'); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                      }}
                    >
                      <span style={{ fontSize: 10 }}>♪</span>
                      <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spec.music.label}</span>
                    </div>
                  )}

                  {/* Image overlay blocks — middle row */}
                  {(spec.imageOverlays ?? []).map(o => (
                    <div
                      key={`img-${o.id}`}
                      style={{ position: 'absolute', left: `${(o.start / spec.duration) * 100}%`, width: `${Math.max(2, (o.duration / spec.duration) * 100)}%`, top: 34, height: 22, background: selectedImgId === o.id ? '#1a1a17' : 'rgba(77,159,255,0.85)', borderRadius: 5, cursor: 'grab', userSelect: 'none', display: 'flex', alignItems: 'center', paddingLeft: 6, overflow: 'hidden', zIndex: 5, gap: 4 }}
                      onMouseDown={e => {
                        e.stopPropagation(); e.preventDefault()
                        setSelectedImgId(o.id); setActivePanel('image')
                        const rect = timelineRef.current!.getBoundingClientRect()
                        const startX = e.clientX; const origStart = o.start; const dur = o.duration
                        const onMove = (me: MouseEvent) => {
                          const dx = (me.clientX - startX) / rect.width * spec.duration
                          const newStart = Math.max(0, Math.min(spec.duration - dur, origStart + dx))
                          setSpec(s => ({ ...s, imageOverlays: (s.imageOverlays ?? []).map(x => x.id === o.id ? { ...x, start: newStart } : x) }))
                        }
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                      }}
                    >
                      <span style={{ fontSize: 10 }}>🖼</span>
                    </div>
                  ))}

                  {/* Caption / text overlay blocks — bottom row */}
                  {spec.overlays.map(o => (
                    <div
                      key={o.id}
                      title={o.text}
                      style={{ position: 'absolute', left: `${(o.start / spec.duration) * 100}%`, width: `${Math.max(2, (o.duration / spec.duration) * 100)}%`, top: 62, height: 22, background: selectedOverlayId === o.id ? '#0f766e' : 'rgba(20,184,166,0.85)', borderRadius: 5, cursor: 'grab', overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: 8, userSelect: 'none', zIndex: 5 }}
                      onMouseDown={e => {
                        e.stopPropagation(); e.preventDefault()
                        setSelectedOverlayId(o.id); setActivePanel('text')
                        const rect = timelineRef.current!.getBoundingClientRect()
                        const startX = e.clientX; const origStart = o.start; const dur = o.duration
                        const onMove = (me: MouseEvent) => {
                          const dx = (me.clientX - startX) / rect.width * spec.duration
                          const newStart = Math.max(0, Math.min(spec.duration - dur, origStart + dx))
                          setSpec(s => ({ ...s, overlays: s.overlays.map(x => x.id === o.id ? { ...x, start: newStart } : x) }))
                        }
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                      }}
                    >
                      <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scrub input (hidden but functional) */}
              <input
                type="range"
                min={0}
                max={spec.duration || 1}
                step={0.05}
                value={currentTime}
                onChange={e => {
                  const t = parseFloat(e.target.value)
                  setCurrentTime(t)
                  if (videoRef.current) videoRef.current.currentTime = t
                }}
                style={{ display: 'none' }}
              />
            </div>
          )}
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div style={S.rightPanel}>
          {/* Tab row */}
          <div style={S.tabRow}>
            {PANEL_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActivePanel(tab.id)} style={S.tab(activePanel === tab.id)}>
                <span style={S.tabIcon}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel body */}
          <div style={S.panelBody}>

            {/* ── Trim ─────────────────────────────────────────────────── */}
            {activePanel === 'trim' && (
              <>
                <div>
                  <div style={S.sectionLabel}>Trim Controls</div>
                  <div style={S.sliderWrap}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label style={S.fieldLabel}>In point</label>
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmt(spec.trimStart)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={spec.duration || 1}
                      step={0.05}
                      value={spec.trimStart}
                      onChange={e => pushHistory({ ...spec, trimStart: Math.min(parseFloat(e.target.value), spec.trimEnd - 0.1) })}
                      style={{ width: '100%', accentColor: 'var(--ink)' }}
                    />
                  </div>
                </div>
                <div>
                  <div style={S.sliderWrap}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label style={S.fieldLabel}>Out point</label>
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmt(spec.trimEnd)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={spec.duration || 1}
                      step={0.05}
                      value={spec.trimEnd}
                      onChange={e => pushHistory({ ...spec, trimEnd: Math.max(parseFloat(e.target.value), spec.trimStart + 0.1) })}
                      style={{ width: '100%', accentColor: 'var(--ink)' }}
                    />
                  </div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--ink-dim)' }}>Final duration</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {Math.max(0, spec.trimEnd - spec.trimStart).toFixed(2)}s
                    </span>
                  </div>
                </div>
                <button
                  style={{ ...S.ghostBtn, fontSize: 12 }}
                  onClick={() => pushHistory({ ...spec, trimStart: 0, trimEnd: spec.duration })}
                >
                  Reset trim
                </button>
              </>
            )}

            {/* ── Text overlays ─────────────────────────────────────────── */}
            {activePanel === 'text' && (
              <>
                {/* Auto Caption */}
                <div>
                  <div style={S.sectionLabel}>Auto Caption</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Language selector */}
                    <div>
                      <label style={S.fieldLabel}>Language</label>
                      <select
                        value={captionLanguage}
                        onChange={e => setCaptionLanguage(e.target.value)}
                        style={{ ...S.input, cursor: 'pointer' }}
                        disabled={captionLoading}
                      >
                        <option value="auto">🌐 Auto detect</option>
                        <option value="en">🇺🇸 English</option>
                        <option value="fr">🇫🇷 French</option>
                        <option value="es">🇪🇸 Spanish</option>
                        <option value="de">🇩🇪 German</option>
                        <option value="it">🇮🇹 Italian</option>
                        <option value="pt">🇧🇷 Portuguese</option>
                        <option value="ar">🇸🇦 Arabic</option>
                        <option value="zh">🇨🇳 Chinese</option>
                        <option value="ja">🇯🇵 Japanese</option>
                        <option value="ko">🇰🇷 Korean</option>
                        <option value="ru">🇷🇺 Russian</option>
                        <option value="hi">🇮🇳 Hindi</option>
                        <option value="tr">🇹🇷 Turkish</option>
                        <option value="nl">🇳🇱 Dutch</option>
                        <option value="pl">🇵🇱 Polish</option>
                        <option value="id">🇮🇩 Indonesian</option>
                      </select>
                    </div>
                    <button
                      style={{
                        ...S.primaryBtn,
                        opacity: (!spec.videoUrl || captionLoading) ? 0.5 : 1,
                        cursor: (!spec.videoUrl || captionLoading) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                      onClick={handleAutoCaption}
                      disabled={!spec.videoUrl || captionLoading}
                    >
                      {captionLoading
                        ? <><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--on-ink-subtle)', borderTopColor: 'var(--on-ink)', animation: 'spin 0.7s linear infinite' }} />Transcribing…</>
                        : <><span style={{ fontSize: 16 }}>✦</span> Generate Captions</>
                      }
                    </button>
                    {captionError && (
                      <div style={{ fontSize: 12, color: '#e84040', padding: '6px 10px', borderRadius: 6, background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.2)' }}>
                        {captionError}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                      Uses AI to transcribe speech and add synced captions automatically.
                    </div>
                  </div>
                </div>

                {/* Caption style presets */}
                {spec.overlays.length > 0 && (
                  <div>
                    <div style={S.sectionLabel}>Caption Style</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
                      {CAPTION_STYLES.map(cs => (
                        <button
                          key={cs.id}
                          onClick={() => applyCaptionStyleToAll(cs.id as TextOverlay['style'])}
                          title={cs.label}
                          style={{
                            border: activeCaptionStyle === cs.id ? '2px solid var(--ink)' : '1px solid var(--border)',
                            borderRadius: 8, padding: '6px 4px', cursor: 'pointer',
                            background: cs.preview.bg === 'transparent' ? 'var(--surface-2)' : cs.preview.bg,
                            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3,
                          }}
                        >
                          <span style={{ fontSize: 10, fontWeight: 800, color: cs.preview.color }}>Aa</span>
                          <span style={{ fontSize: 8, color: 'var(--ink-mute)', lineHeight: 1 }}>{cs.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick stickers */}
                <div>
                  <div style={S.sectionLabel}>Quick Stickers</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    {EMOJI_STICKERS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => addEmojiSticker(emoji)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          cursor: 'pointer',
                          fontSize: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.15s',
                        }}
                        title={`Add ${emoji} at current time`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {spec.overlays.length > 0 && (
                  <div>
                    <div style={S.sectionLabel}>Active Overlays</div>
                    {spec.overlays.map(o => {
                      const isExp = expandedOverlayId === o.id
                      const updateOv = (patch: Partial<TextOverlay>) =>
                        pushHistory({ ...spec, overlays: spec.overlays.map(x => x.id === o.id ? { ...x, ...patch } : x) })
                      return (
                        <div key={o.id} style={{ borderRadius: 10, border: `1px solid ${isExp ? 'var(--ink)' : 'var(--border)'}`, marginBottom: 8, overflow: 'hidden', background: 'var(--surface-2)' }}>
                          {/* Header row */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
                            onClick={() => setExpandedOverlayId(isExp ? null : o.id)}
                          >
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: o.color ?? '#ffffff', border: '1px solid var(--border)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.text}</div>
                              <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>{fmt(o.start)} – {fmt(o.start + o.duration)} · {o.style ?? 'caption'}</div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--ink-mute)', transform: isExp ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▾</span>
                            <button onClick={e => { e.stopPropagation(); pushHistory({ ...spec, overlays: spec.overlays.filter(x => x.id !== o.id) }) }} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                          </div>
                          {/* Expanded editor */}
                          {isExp && (
                            <div style={{ padding: '0 10px 12px', display: 'flex', flexDirection: 'column' as const, gap: 10, borderTop: '1px solid var(--border)' }}>
                              {/* Text */}
                              <div style={{ paddingTop: 10 }}>
                                <label style={S.fieldLabel}>Text</label>
                                <input value={o.text} onChange={e => updateOv({ text: e.target.value })} style={S.input} />
                              </div>
                              {/* Style */}
                              <div>
                                <label style={S.fieldLabel}>Caption Style</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
                                  {CAPTION_STYLES.map(cs => (
                                    <button key={cs.id} onClick={() => updateOv({ style: cs.id as TextOverlay['style'] })}
                                      style={{ border: (o.style ?? 'caption') === cs.id ? '2px solid var(--ink)' : '1px solid var(--border)', borderRadius: 7, padding: '5px 3px', cursor: 'pointer', background: cs.preview.bg === 'transparent' ? 'var(--surface-3)' : cs.preview.bg, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 }}>
                                      <span style={{ fontSize: 10, fontWeight: 800, color: cs.preview.color }}>Aa</span>
                                      <span style={{ fontSize: 7, color: 'var(--ink-mute)' }}>{cs.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Text color */}
                              <div>
                                <label style={S.fieldLabel}>Text Color</label>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                                  {COLOR_SWATCHES.map(sw => (
                                    <button key={sw.hex} onClick={() => updateOv({ color: sw.hex })} title={sw.label}
                                      style={{ width: 22, height: 22, borderRadius: '50%', background: sw.hex, border: `2px solid ${(o.color ?? '#ffffff') === sw.hex ? 'var(--ink)' : 'var(--border)'}`, cursor: 'pointer', padding: 0 }} />
                                  ))}
                                  <input type="color" value={o.color ?? '#ffffff'} onChange={e => updateOv({ color: e.target.value })}
                                    style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', padding: 0, cursor: 'pointer', background: 'none' }} title="Custom color" />
                                </div>
                              </div>
                              {/* BG / stroke color */}
                              {(o.style === 'caption' || o.style === 'highlight' || o.style === 'bubble') && (
                                <div>
                                  <label style={S.fieldLabel}>Background Color</label>
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                                    {COLOR_SWATCHES.map(sw => (
                                      <button key={sw.hex} onClick={() => updateOv({ bgColor: sw.hex })} title={sw.label}
                                        style={{ width: 22, height: 22, borderRadius: '50%', background: sw.hex, border: `2px solid ${(o.bgColor) === sw.hex ? 'var(--ink)' : 'var(--border)'}`, cursor: 'pointer', padding: 0 }} />
                                    ))}
                                    <input type="color" value={o.bgColor ?? '#000000'} onChange={e => updateOv({ bgColor: e.target.value })}
                                      style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', padding: 0, cursor: 'pointer', background: 'none' }} title="Custom bg color" />
                                  </div>
                                </div>
                              )}
                              {(o.style === 'tiktok' || o.style === 'outline') && (
                                <div>
                                  <label style={S.fieldLabel}>Stroke Color</label>
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                                    {COLOR_SWATCHES.map(sw => (
                                      <button key={sw.hex} onClick={() => updateOv({ strokeColor: sw.hex })} title={sw.label}
                                        style={{ width: 22, height: 22, borderRadius: '50%', background: sw.hex, border: `2px solid ${(o.strokeColor) === sw.hex ? 'var(--ink)' : 'var(--border)'}`, cursor: 'pointer', padding: 0 }} />
                                    ))}
                                    <input type="color" value={o.strokeColor ?? '#000000'} onChange={e => updateOv({ strokeColor: e.target.value })}
                                      style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', padding: 0, cursor: 'pointer', background: 'none' }} title="Custom stroke" />
                                  </div>
                                </div>
                              )}
                              {/* Font family */}
                              <div>
                                <label style={S.fieldLabel}>Font</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                                  {FONT_FAMILIES.map(ff => (
                                    <button key={ff.id} onClick={() => updateOv({ fontFamily: ff.id })}
                                      style={{ border: (o.fontFamily ?? 'sans') === ff.id ? '2px solid var(--ink)' : '1px solid var(--border)', borderRadius: 6, padding: '5px 3px', cursor: 'pointer', background: (o.fontFamily ?? 'sans') === ff.id ? 'var(--ink)' : 'var(--surface-3)', color: (o.fontFamily ?? 'sans') === ff.id ? 'var(--surface)' : 'var(--ink-dim)', fontSize: 10, fontWeight: 600, fontFamily: ff.css }}>
                                      {ff.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Font size */}
                              <div>
                                <label style={S.fieldLabel}>Size</label>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {(['sm', 'md', 'lg', 'xl'] as const).map(sz => (
                                    <button key={sz} onClick={() => updateOv({ fontSize: sz })}
                                      style={{ flex: 1, padding: '5px 3px', borderRadius: 6, border: `1px solid ${(o.fontSize ?? 'md') === sz ? 'var(--ink)' : 'var(--border)'}`, background: (o.fontSize ?? 'md') === sz ? 'var(--ink)' : 'var(--surface-3)', color: (o.fontSize ?? 'md') === sz ? 'var(--surface)' : 'var(--ink-dim)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' as const }}>
                                      {sz}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Animation */}
                              <div>
                                <label style={S.fieldLabel}>Animation</label>
                                <select value={o.animation ?? 'none'} onChange={e => updateOv({ animation: e.target.value as TextOverlay['animation'] })} style={{ ...S.input, cursor: 'pointer' }}>
                                  <option value="none">None</option>
                                  <option value="fade">Fade In</option>
                                  <option value="slide-up">Slide Up</option>
                                  <option value="zoom">Zoom In</option>
                                  <option value="typewriter">Typewriter</option>
                                </select>
                              </div>
                              {/* Timing */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <div>
                                  <label style={S.fieldLabel}>Start (s)</label>
                                  <input type="number" min={0} max={spec.duration} step={0.1} value={o.start} onChange={e => updateOv({ start: parseFloat(e.target.value) || 0 })} style={S.input} />
                                </div>
                                <div>
                                  <label style={S.fieldLabel}>Duration (s)</label>
                                  <input type="number" min={0.1} max={spec.duration} step={0.1} value={o.duration} onChange={e => updateOv({ duration: parseFloat(e.target.value) || 1 })} style={S.input} />
                                </div>
                              </div>
                              {/* X/Y position */}
                              <div>
                                <label style={S.fieldLabel}>Position X — {Math.round((o.x ?? 0.5) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.01} value={o.x ?? 0.5} onChange={e => updateOv({ x: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                              </div>
                              <div>
                                <label style={S.fieldLabel}>Position Y — {Math.round((o.y ?? (o.position === 'top' ? 0.12 : o.position === 'center' ? 0.5 : 0.85)) * 100)}%</label>
                                <input type="range" min={0} max={1} step={0.01} value={o.y ?? (o.position === 'top' ? 0.12 : o.position === 'center' ? 0.5 : 0.85)} onChange={e => updateOv({ y: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div>
                  <div style={S.sectionLabel}>Add Overlay</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={S.fieldLabel}>Text content</label>
                      <input type="text" placeholder="Your text here..." value={newText} onChange={e => setNewText(e.target.value)} style={S.input} />
                    </div>

                    {/* Color swatches */}
                    <div>
                      <label style={S.fieldLabel}>Color</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {COLOR_SWATCHES.map(sw => (
                          <button
                            key={sw.hex}
                            onClick={() => setNewColor(sw.hex)}
                            title={sw.label}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: sw.hex,
                              border: `2px solid ${newColor === sw.hex ? 'var(--ink)' : 'var(--border)'}`,
                              cursor: 'pointer',
                              padding: 0,
                              flexShrink: 0,
                              boxShadow: newColor === sw.hex ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)' : 'none',
                              transition: 'all 0.15s',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Animation */}
                    <div>
                      <label style={S.fieldLabel}>Entrance Animation</label>
                      <select
                        value={newAnimation ?? 'none'}
                        onChange={e => setNewAnimation(e.target.value as TextOverlay['animation'])}
                        style={{ ...S.input, cursor: 'pointer' }}
                      >
                        <option value="none">None</option>
                        <option value="fade">Fade In</option>
                        <option value="slide-up">Slide Up</option>
                        <option value="zoom">Zoom In</option>
                        <option value="typewriter">Typewriter</option>
                      </select>
                    </div>

                    {/* Font size */}
                    <div>
                      <label style={S.fieldLabel}>Font size</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => setNewFontSize(size)}
                            style={{
                              flex: 1,
                              padding: '6px 4px',
                              borderRadius: 6,
                              border: `1px solid ${newFontSize === size ? 'var(--ink)' : 'var(--border)'}`,
                              background: newFontSize === size ? 'var(--ink)' : 'var(--surface-2)',
                              color: newFontSize === size ? 'var(--surface)' : 'var(--ink-dim)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'center' as const,
                              textTransform: 'uppercase' as const,
                              transition: 'all 0.15s',
                            }}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={S.fieldLabel}>Start (s)</label>
                        <input type="number" min={0} max={spec.duration} step={0.1} value={newStart} onChange={e => setNewStart(parseFloat(e.target.value) || 0)} style={S.input} />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>Duration (s)</label>
                        <input type="number" min={0.5} max={spec.duration} step={0.1} value={newDuration} onChange={e => setNewDuration(parseFloat(e.target.value) || 1)} style={S.input} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={S.fieldLabel}>Position</label>
                        <select value={newPosition} onChange={e => setNewPosition(e.target.value as TextOverlay['position'])} style={S.select}>
                          <option value="top">Top</option>
                          <option value="center">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>
                      <div>
                        <label style={S.fieldLabel}>Style</label>
                        <select value={newStyle} onChange={e => setNewStyle(e.target.value as TextOverlay['style'])} style={S.select}>
                          <option value="bold-white">Bold</option>
                          <option value="minimal">Minimal</option>
                          <option value="caption">Caption</option>
                        </select>
                      </div>
                    </div>
                    <button style={{ ...S.primaryBtn, opacity: newText.trim() ? 1 : 0.4, cursor: newText.trim() ? 'pointer' : 'not-allowed' }} onClick={addOverlay} disabled={!newText.trim()}>
                      Add Overlay
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Image overlays ────────────────────────────────────────── */}
            {activePanel === 'image' && (
              <>
                {/* Add Image section */}
                <div>
                  <div style={S.sectionLabel}>Add Image</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* Upload button */}
                    <button
                      style={S.primaryBtn}
                      onClick={() => imgInputRef.current?.click()}
                    >
                      Upload Image
                    </button>

                    {/* URL input */}
                    <div>
                      <label style={S.fieldLabel}>Or paste URL</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={imgUrl}
                          onChange={e => setImgUrl(e.target.value)}
                          style={{ ...S.input, flex: 1 }}
                        />
                        <button
                          style={{ ...S.primaryBtn, width: 'auto', padding: '8px 14px', whiteSpace: 'nowrap' as const, opacity: imgUrl.trim() ? 1 : 0.4 }}
                          onClick={() => { if (imgUrl.trim()) addImageOverlay(imgUrl.trim()) }}
                          disabled={!imgUrl.trim()}
                        >Add</button>
                      </div>
                    </div>

                    {/* Timing */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={S.fieldLabel}>Start (s)</label>
                        <input type="number" min={0} max={spec.duration} step={0.1} value={imgStart}
                          onChange={e => setImgStart(parseFloat(e.target.value) || 0)} style={S.input} />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>Duration (s)</label>
                        <input type="number" min={0.5} max={spec.duration} step={0.1} value={imgDuration}
                          onChange={e => setImgDuration(parseFloat(e.target.value) || 1)} style={S.input} />
                      </div>
                    </div>

                    {/* Size */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={S.fieldLabel}>Size</label>
                        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{Math.round(imgScale * 100)}%</span>
                      </div>
                      <input type="range" min={0.05} max={1} step={0.01} value={imgScale}
                        onChange={e => setImgScale(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--ink)' }} />
                    </div>

                    {/* Opacity */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={S.fieldLabel}>Opacity</label>
                        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{Math.round(imgOpacity * 100)}%</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.01} value={imgOpacity}
                        onChange={e => setImgOpacity(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--ink)' }} />
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                      Upload a logo, watermark, or product image. Drag it on the canvas to reposition.
                    </div>
                  </div>
                </div>

                {/* Active images list */}
                {(spec.imageOverlays ?? []).length > 0 && (
                  <div>
                    <div style={S.sectionLabel}>Active Images</div>
                    {(spec.imageOverlays ?? []).map(o => (
                      <div key={o.id} style={{ ...S.overlayCard, marginBottom: 8, gap: 8 }}>
                        <img
                          src={o.src}
                          alt=""
                          style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.src.startsWith('blob:') ? 'Local image' : o.src.split('/').pop()?.slice(0, 20) ?? 'Image'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                            {fmt(o.start)} – {fmt(o.start + o.duration)} · {Math.round(o.scale * 100)}% · {Math.round(o.opacity * 100)}% opacity
                          </div>
                        </div>
                        <button
                          onClick={() => pushHistory({ ...spec, imageOverlays: (spec.imageOverlays ?? []).filter(x => x.id !== o.id) })}
                          style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit selected image */}
                {selectedImgId && (spec.imageOverlays ?? []).find(o => o.id === selectedImgId) && (() => {
                  const sel = (spec.imageOverlays ?? []).find(o => o.id === selectedImgId)!
                  return (
                    <div>
                      <div style={S.sectionLabel}>Selected Image</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <label style={S.fieldLabel}>Size</label>
                            <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{Math.round(sel.scale * 100)}%</span>
                          </div>
                          <input type="range" min={0.05} max={1} step={0.01} value={sel.scale}
                            onChange={e => pushHistory({ ...spec, imageOverlays: (spec.imageOverlays ?? []).map(o => o.id === selectedImgId ? { ...o, scale: parseFloat(e.target.value) } : o) })}
                            style={{ width: '100%', accentColor: 'var(--ink)' }} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <label style={S.fieldLabel}>Opacity</label>
                            <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{Math.round(sel.opacity * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.01} value={sel.opacity}
                            onChange={e => pushHistory({ ...spec, imageOverlays: (spec.imageOverlays ?? []).map(o => o.id === selectedImgId ? { ...o, opacity: parseFloat(e.target.value) } : o) })}
                            style={{ width: '100%', accentColor: 'var(--ink)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={S.fieldLabel}>Start (s)</label>
                            <input type="number" min={0} max={spec.duration} step={0.1} value={sel.start}
                              onChange={e => pushHistory({ ...spec, imageOverlays: (spec.imageOverlays ?? []).map(o => o.id === selectedImgId ? { ...o, start: parseFloat(e.target.value) || 0 } : o) })}
                              style={S.input} />
                          </div>
                          <div>
                            <label style={S.fieldLabel}>Duration (s)</label>
                            <input type="number" min={0.5} step={0.1} value={sel.duration}
                              onChange={e => pushHistory({ ...spec, imageOverlays: (spec.imageOverlays ?? []).map(o => o.id === selectedImgId ? { ...o, duration: parseFloat(e.target.value) || 1 } : o) })}
                              style={S.input} />
                          </div>
                        </div>
                        <button
                          style={{ ...S.ghostBtn, fontSize: 12 }}
                          onClick={() => setSelectedImgId(null)}
                        >Deselect</button>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {/* ── Adjust ────────────────────────────────────────────────── */}
            {activePanel === 'adjust' && (
              <>
                {/* Color & Filters */}
                <div>
                  <div style={S.sectionLabel}>Color & Filters</div>
                  {/* Preset grid 3x2 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                    {(Object.keys(FILTER_PRESETS) as Array<keyof typeof FILTER_PRESETS>).map(preset => {
                      const isActive = currentFilters.preset === preset
                      return (
                        <button
                          key={preset}
                          onClick={() => {
                            const vals = FILTER_PRESETS[preset]
                            pushHistory({
                              ...spec,
                              filters: { ...vals, preset: preset as EditSpec['filters'] extends undefined ? never : NonNullable<EditSpec['filters']>['preset'] },
                            })
                          }}
                          style={{
                            padding: '7px 4px',
                            borderRadius: 6,
                            border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border)'}`,
                            background: isActive ? 'var(--ink)' : 'var(--surface-2)',
                            color: isActive ? 'var(--surface)' : 'var(--ink-dim)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'center' as const,
                            transition: 'all 0.15s',
                          }}
                        >
                          {PRESET_LABELS[preset]}
                        </button>
                      )
                    })}
                  </div>

                  {/* Brightness */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={S.fieldLabel}>Brightness</label>
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{currentFilters.brightness.toFixed(2)}</span>
                    </div>
                    <input type="range" min={0} max={2} step={0.05} value={currentFilters.brightness}
                      onChange={e => pushHistory({ ...spec, filters: { ...currentFilters, brightness: parseFloat(e.target.value), preset: 'none' } })}
                      style={{ width: '100%', accentColor: 'var(--ink)' }}
                    />
                  </div>

                  {/* Contrast */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={S.fieldLabel}>Contrast</label>
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{currentFilters.contrast.toFixed(2)}</span>
                    </div>
                    <input type="range" min={0} max={2} step={0.05} value={currentFilters.contrast}
                      onChange={e => pushHistory({ ...spec, filters: { ...currentFilters, contrast: parseFloat(e.target.value), preset: 'none' } })}
                      style={{ width: '100%', accentColor: 'var(--ink)' }}
                    />
                  </div>

                  {/* Saturation */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={S.fieldLabel}>Saturation</label>
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{currentFilters.saturation.toFixed(2)}</span>
                    </div>
                    <input type="range" min={0} max={2} step={0.05} value={currentFilters.saturation}
                      onChange={e => pushHistory({ ...spec, filters: { ...currentFilters, saturation: parseFloat(e.target.value), preset: 'none' } })}
                      style={{ width: '100%', accentColor: 'var(--ink)' }}
                    />
                  </div>
                </div>

                {/* Speed & Audio */}
                <div>
                  <div style={S.sectionLabel}>Speed & Audio</div>

                  {/* Speed pills */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={S.fieldLabel}>Playback speed</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                      {SPEED_OPTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => pushHistory({ ...spec, speed: s })}
                          style={S.pillBtn((spec.speed ?? 1) === s)}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Video volume */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={S.fieldLabel}>Video volume</label>
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{Math.round((spec.volume ?? 1) * 100)}%</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.01} value={spec.volume ?? 1}
                      onChange={e => pushHistory({ ...spec, volume: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--ink)' }}
                    />
                  </div>

                  {/* Mute toggle */}
                  <button
                    onClick={() => {
                      setIsMuted(m => !m)
                      if (videoRef.current) videoRef.current.muted = !isMuted
                    }}
                    style={{
                      ...S.ghostBtn,
                      borderColor: isMuted ? 'var(--ink)' : 'var(--border)',
                      color: isMuted ? 'var(--ink)' : 'var(--ink-dim)',
                      fontSize: 12,
                    }}
                  >
                    {isMuted ? '🔇 Muted (preview only)' : '🔊 Mute preview'}
                  </button>
                </div>

                {/* Transitions */}
                <div>
                  <div style={S.sectionLabel}>Transitions</div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    <div
                      style={S.toggleCard(!!spec.fadeIn)}
                      onClick={() => pushHistory({ ...spec, fadeIn: !spec.fadeIn })}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Fade In</span>
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `2px solid ${spec.fadeIn ? 'var(--ink)' : 'var(--border)'}`,
                        background: spec.fadeIn ? 'var(--ink)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {spec.fadeIn && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--surface)" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                      </div>
                    </div>
                    <div
                      style={S.toggleCard(!!spec.fadeOut)}
                      onClick={() => pushHistory({ ...spec, fadeOut: !spec.fadeOut })}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Fade Out</span>
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `2px solid ${spec.fadeOut ? 'var(--ink)' : 'var(--border)'}`,
                        background: spec.fadeOut ? 'var(--ink)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {spec.fadeOut && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--surface)" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ken Burns / Zoom */}
                <div>
                  <div style={S.sectionLabel}>Ken Burns Zoom</div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                    <div
                      style={S.toggleCard(!!spec.zoom)}
                      onClick={() => {
                        if (spec.zoom) {
                          pushHistory({ ...spec, zoom: undefined })
                          setZoomEnabled(false)
                        } else {
                          pushHistory({ ...spec, zoom: { fromScale: 1.0, toScale: 1.3, fromX: 0.5, fromY: 0.5, toX: 0.5, toY: 0.5 } })
                          setZoomEnabled(true)
                        }
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Enable Zoom Effect</span>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4,
                        border: `2px solid ${spec.zoom ? 'var(--ink)' : 'var(--border)'}`,
                        background: spec.zoom ? 'var(--ink)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                      }}>
                        {spec.zoom && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--surface)" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                      </div>
                    </div>

                    {spec.zoom && (
                      <>
                        {/* Direction presets */}
                        <div>
                          <label style={S.fieldLabel}>Direction Preset</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                            {[
                              { label: 'Center In',        z: { fromScale: 1.0, toScale: 1.3, fromX: 0.5, fromY: 0.5, toX: 0.5, toY: 0.5 } },
                              { label: 'Pan Right',        z: { fromScale: 1.2, toScale: 1.2, fromX: 0.2, fromY: 0.5, toX: 0.8, toY: 0.5 } },
                              { label: 'Pan Left',         z: { fromScale: 1.2, toScale: 1.2, fromX: 0.8, fromY: 0.5, toX: 0.2, toY: 0.5 } },
                              { label: 'Top Left→Center',  z: { fromScale: 1.2, toScale: 1.0, fromX: 0.2, fromY: 0.2, toX: 0.5, toY: 0.5 } },
                            ].map(p => (
                              <button
                                key={p.label}
                                onClick={() => pushHistory({ ...spec, zoom: p.z })}
                                style={{ padding: '6px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink-dim)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                              >{p.label}</button>
                            ))}
                          </div>
                        </div>

                        {/* From/To scale sliders */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <label style={S.fieldLabel}>From Scale</label>
                            <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{spec.zoom.fromScale.toFixed(1)}x</span>
                          </div>
                          <input type="range" min={1} max={2} step={0.05} value={spec.zoom.fromScale}
                            onChange={e => pushHistory({ ...spec, zoom: { ...spec.zoom!, fromScale: parseFloat(e.target.value) } })}
                            style={{ width: '100%', accentColor: 'var(--ink)' }} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <label style={S.fieldLabel}>To Scale</label>
                            <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{spec.zoom.toScale.toFixed(1)}x</span>
                          </div>
                          <input type="range" min={1} max={2} step={0.05} value={spec.zoom.toScale}
                            onChange={e => pushHistory({ ...spec, zoom: { ...spec.zoom!, toScale: parseFloat(e.target.value) } })}
                            style={{ width: '100%', accentColor: 'var(--ink)' }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Crop / Reframe */}
                <div>
                  <div style={S.sectionLabel}>Crop / Reframe</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'Original', crop: undefined },
                      { label: 'Square 1:1', crop: { x: 0.125, y: 0, w: 0.75, h: 1 } },
                      { label: '16:9 Wide', crop: { x: 0, y: 0.156, w: 1, h: 0.688 } },
                      { label: '9:16 Portrait', crop: { x: 0.25, y: 0, w: 0.5, h: 1 } },
                    ].map(p => {
                      const isActive = !p.crop
                        ? !spec.crop
                        : spec.crop && spec.crop.x === p.crop.x && spec.crop.y === p.crop.y
                      return (
                        <button
                          key={p.label}
                          onClick={() => pushHistory({ ...spec, crop: p.crop })}
                          style={{
                            padding: '8px 6px', borderRadius: 7,
                            border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border)'}`,
                            background: isActive ? 'var(--ink)' : 'var(--surface-2)',
                            color: isActive ? 'var(--surface)' : 'var(--ink-dim)',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s',
                          }}
                        >{p.label}</button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── Music ─────────────────────────────────────────────────── */}
            {activePanel === 'music' && (
              <>
                <div style={S.sectionLabel}>Background Track</div>

                {/* Upload from computer */}
                <button
                  style={{ ...S.primaryBtn, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
                  onClick={() => musicInputRef.current?.click()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload from computer
                </button>

                <div
                  style={S.musicCard(!spec.music)}
                  onClick={() => pushHistory({ ...spec, music: undefined })}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔇</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-dim)' }}>No music</div>
                  {!spec.music && <span style={{ marginLeft: 'auto', color: 'var(--ink)', fontSize: 16 }}>✓</span>}
                </div>

                {MUSIC_LIBRARY.map((track, i) => (
                  <div
                    key={track.url}
                    style={S.musicCard(spec.music?.url === track.url)}
                    onClick={() => pushHistory({ ...spec, music: { ...track, volume: spec.music?.volume ?? track.volume } })}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {['🎵', '🎶', '🎸', '🎼', '🎹', '🥁'][i] ?? '🎵'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{track.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Royalty-free</div>
                    </div>
                    {spec.music?.url === track.url && <span style={{ marginLeft: 'auto', color: 'var(--ink)', fontSize: 16 }}>✓</span>}
                  </div>
                ))}

                {spec.music && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={S.fieldLabel}>Volume</label>
                      <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{Math.round((spec.music.volume ?? 0.25) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={spec.music.volume ?? 0.25}
                      onChange={e => {
                        if (!spec.music) return
                        pushHistory({ ...spec, music: { ...spec.music, volume: parseFloat(e.target.value) } })
                      }}
                      style={{ width: '100%', accentColor: 'var(--ink)' }}
                    />
                  </div>
                )}
              </>
            )}

            {/* ── AI Edit ───────────────────────────────────────────────── */}
            {activePanel === 'ai' && (
              <>
                <div style={S.sectionLabel}>AI Editor</div>
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
                  Describe any edit in plain language and AI will apply it instantly.
                </div>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {AI_EXAMPLES.map(ex => (
                      <button
                        key={ex}
                        onClick={() => setAiInput(ex)}
                        style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink-dim)', fontSize: 12, cursor: 'pointer' }}
                      >
                        "{ex}"
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={S.fieldLabel}>Your instruction</label>
                  <textarea
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    placeholder="Describe what you want to change..."
                    rows={4}
                    style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>
                <button
                  style={{ ...S.primaryBtn, opacity: aiLoading || !aiInput.trim() ? 0.5 : 1, cursor: aiLoading || !aiInput.trim() ? 'not-allowed' : 'pointer' }}
                  disabled={aiLoading || !aiInput.trim()}
                  onClick={handleAiEdit}
                >
                  {aiLoading ? '✧ Applying...' : '✧ Apply AI Edit'}
                </button>
              </>
            )}

            {/* ── Export ────────────────────────────────────────────────── */}
            {activePanel === 'export' && (
              <>
                <div style={S.sectionLabel}>Render Summary</div>
                <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {[
                    ['Aspect ratio', spec.aspectRatio],
                    ['In → Out', `${fmt(spec.trimStart)} → ${fmt(spec.trimEnd)}`],
                    ['Final duration', `${(spec.trimEnd - spec.trimStart).toFixed(2)}s`],
                    ['Speed', `${spec.speed ?? 1}x`],
                    ['Transitions', [spec.fadeIn && 'Fade In', spec.fadeOut && 'Fade Out'].filter(Boolean).join(', ') || 'None'],
                    ['Filters', currentFilters.preset !== 'none' ? PRESET_LABELS[currentFilters.preset] : 'None'],
                    ['Text overlays', String(spec.overlays.length)],
                    ['Music', spec.music ? `${spec.music.label} (${Math.round(spec.music.volume * 100)}%)` : 'None'],
                  ].map(([k, v], i, arr) => (
                    <div key={k} style={{ ...S.summaryRow, padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', margin: 0 }}>
                      <span style={{ color: 'var(--ink-mute)' }}>{k}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
                  Rendered locally in your browser — no upload needed. Output is WebM (plays everywhere).
                </div>

                <button
                  style={{ ...S.primaryBtn, opacity: exporting ? 0.6 : 1 }}
                  disabled={exporting}
                  onClick={handleExport}
                >
                  {exporting ? (exportStatus || 'Rendering...') : '↗ Export Video'}
                </button>

                {/* Progress bar */}
                {exporting && (
                  <div>
                    <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{
                        height: '100%',
                        width: `${exportProgress}%`,
                        background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                        borderRadius: 99,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4, textAlign: 'center' as const }}>
                      {exportStatus}
                    </div>
                  </div>
                )}

                {/* Completion info */}
                {!exporting && exportStatus.startsWith('Done') && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 12, color: '#16a34a', fontWeight: 600, textAlign: 'center' as const }}>
                    {exportStatus}
                  </div>
                )}

                {exportUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <a
                      href={exportUrl}
                      download
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--ink)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download Video
                    </a>
                    <button
                      disabled={savingToLibrary || savedToLibrary}
                      onClick={async () => {
                        const blob = exportBlobRef.current
                        if (!blob) return
                        setSavingToLibrary(true)
                        try {
                          const supabase = getSupabase()
                          if (!supabase) throw new Error('Not signed in')
                          const { data: session } = await supabase.auth.getSession()
                          const token = session?.session?.access_token
                          if (!token) throw new Error('Not signed in')

                          const filename = `contentflow-edit-${new Date().toISOString().slice(0, 10)}.webm`

                          // Step 1: upload blob to Supabase temp storage (client → Supabase, no CORS issues)
                          const urlRes = await fetch('/api/upload-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ folder: 'drive-tmp', ext: 'webm' }),
                          })
                          const { signedUrl, storagePath, error: urlErr } = await urlRes.json()
                          if (urlErr) throw new Error(urlErr)
                          const putRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': 'video/webm' }, body: blob })
                          if (!putRes.ok) throw new Error(`Temp upload failed: ${putRes.status}`)

                          // Step 2: server fetches from Supabase and pushes to Drive (no CORS, no body limit)
                          const driveRes = await fetch('/api/drive/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ storagePath, filename }),
                          })
                          const driveData = await driveRes.json()
                          if (!driveRes.ok) throw new Error(driveData.error ?? 'Drive upload failed')
                          setSavedToLibrary(true)
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Save failed')
                        } finally {
                          setSavingToLibrary(false)
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, background: savedToLibrary ? '#16a34a' : 'var(--ink)', border: 'none', color: 'var(--on-ink)', fontSize: 13, fontWeight: 700, cursor: savingToLibrary || savedToLibrary ? 'default' : 'pointer', opacity: savingToLibrary ? 0.7 : 1 }}
                    >
                      {savingToLibrary ? (
                        <><span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: '50%', border: '2px solid var(--on-ink-subtle)', borderTopColor: 'var(--on-ink)', animation: 'spin 0.7s linear infinite' }} />Saving…</>
                      ) : savedToLibrary ? '✓ Saved to Library' : (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save to Library</>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
