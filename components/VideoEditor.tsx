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
}

const PRESET_LABELS: Record<string, string> = {
  none: 'None', bw: 'B&W', vintage: 'Vintage', vivid: 'Vivid', cinema: 'Cinema', muted: 'Muted',
}

const COLOR_SWATCHES = [
  { hex: '#ffffff', label: 'White' },
  { hex: '#000000', label: 'Black' },
  { hex: '#FFE14D', label: 'Yellow' },
  { hex: '#FF4444', label: 'Red' },
  { hex: '#4D9FFF', label: 'Blue' },
  { hex: '#4DFF91', label: 'Green' },
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
  const [imgStart, setImgStart] = useState(0)
  const [imgDuration, setImgDuration] = useState(3)
  const [imgScale, setImgScale] = useState(0.3)
  const [imgOpacity, setImgOpacity] = useState(1)
  const [imgUrl, setImgUrl] = useState('')
  const [selectedImgId, setSelectedImgId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const isDraggingTrim = useRef<null | 'start' | 'end'>(null)
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
    setExporting(true)
    setExportStatus('Submitting to Shotstack...')
    setExportUrl(null)
    try {
      const supabase = getSupabase()
      const { data: session } = await supabase!.auth.getSession()
      const token = session?.session?.access_token
      const { data: userInfo } = await supabase!.auth.getUser(token ?? '')

      // Upload any blob: image overlays to Supabase before export
      let exportSpec = { ...spec }
      const blobImages = (spec.imageOverlays ?? []).filter(o => o.src.startsWith('blob:'))
      if (blobImages.length > 0) {
        setExportStatus('Uploading images...')
        const uploadedImages = await Promise.all(
          blobImages.map(async o => {
            const blob = await fetch(o.src).then(r => r.blob())
            const ext = blob.type.split('/')[1] || 'png'
            const filename = `editor-images/${userInfo?.user?.id ?? 'anon'}-${Date.now()}-${genId()}.${ext}`
            const supabase2 = getSupabase()!
            const { error: upErr } = await supabase2.storage.from('ugc-assets').upload(filename, blob, { contentType: blob.type, upsert: true })
            if (upErr) throw new Error(`Image upload failed: ${upErr.message}`)
            const { data: { publicUrl } } = supabase2.storage.from('ugc-assets').getPublicUrl(filename)
            return { id: o.id, publicUrl }
          })
        )
        exportSpec = {
          ...exportSpec,
          imageOverlays: (exportSpec.imageOverlays ?? []).map(o => {
            const uploaded = uploadedImages.find(u => u.id === o.id)
            return uploaded ? { ...o, src: uploaded.publicUrl } : o
          }),
        }
      }

      const res = await fetch('/api/video/editor-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spec: exportSpec }),
      })
      const { renderId, error } = await res.json()
      if (error) throw new Error(error)
      setExportStatus('Rendering...')
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const poll = await fetch(`/api/video/editor-export?renderId=${renderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const status = await poll.json()
        if (status.url) { setExportUrl(status.url); break }
        if (status.status === 'failed') throw new Error('Render failed')
        setExportStatus(`Rendering... ${status.status ?? ''}`)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
      setExportStatus('')
    }
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

  async function handleAutoCaption() {
    if (!spec.videoUrl) return
    setCaptionLoading(true)
    setCaptionError(null)
    try {
      const supabase = getSupabase()
      const { data: session } = await supabase!.auth.getSession()
      const token = session?.session?.access_token

      let res: Response
      if (spec.videoUrl.startsWith('blob:')) {
        const blob = await fetch(spec.videoUrl).then(r => r.blob())
        const form = new FormData()
        form.append('file', blob, 'video.mp4')
        form.append('duration', String(spec.duration))
        res = await fetch('/api/video/transcribe', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })
      } else {
        res = await fetch('/api/video/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ videoUrl: spec.videoUrl, duration: spec.duration }),
        })
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)
      pushHistory({ ...spec, overlays: [...spec.overlays, ...data.overlays] })
    } catch (e) {
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
      height: 40,
      background: 'var(--surface)',
      borderRadius: 8,
      overflow: 'visible',
      cursor: 'pointer',
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
                  objectFit: 'contain',
                  display: 'block',
                  filter: videoFilterStyle,
                }}
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={e => {
                  const d = e.currentTarget.duration
                  setSpec(s => ({ ...s, duration: d, trimEnd: s.trimEnd === 0 ? d : s.trimEnd }))
                }}
              />
              {/* Text overlay previews — draggable */}
              {spec.overlays.map(o => {
                const visible = currentTime >= o.start && currentTime < o.start + o.duration
                const isSelected = selectedOverlayId === o.id
                const xPct = (o.x ?? 0.5) * 100
                const yPct = (o.y ?? (o.position === 'top' ? 0.12 : o.position === 'center' ? 0.5 : 0.82)) * 100
                const overlayFontSize = o.fontSize === 'sm' ? 13 : o.fontSize === 'lg' ? 22 : o.fontSize === 'xl' ? 28 : 18
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
                      color: o.color ?? '#fff',
                      fontSize: overlayFontSize,
                      fontWeight: o.style === 'minimal' ? 400 : 800,
                      textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                      padding: o.style === 'caption' ? '4px 10px' : '2px 12px',
                      background: o.style === 'caption' ? 'rgba(0,0,0,0.6)' : 'none',
                      borderRadius: o.style === 'caption' ? 6 : 0,
                      cursor: 'grab',
                      userSelect: 'none',
                      opacity: visible ? 1 : 0.25,
                      outline: isSelected ? '1.5px dashed var(--ink)' : 'none',
                      outlineOffset: 4,
                      whiteSpace: 'nowrap',
                      maxWidth: '90%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      zIndex: 10,
                    }}
                  >
                    {o.text}
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
              <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 600 }}>
                {(spec.trimEnd - spec.trimStart).toFixed(1)}s trimmed
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
                  style={S.timelineTrack}
                  onClick={e => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const pct = (e.clientX - rect.left) / rect.width
                    const t = pct * spec.duration
                    setCurrentTime(t)
                    if (videoRef.current) videoRef.current.currentTime = t
                  }}
                >
                  {/* Clip fill */}
                  <div style={{
                    position: 'absolute',
                    left: 0, top: 0, right: 0, bottom: 0,
                    background: 'repeating-linear-gradient(90deg, var(--surface-2), var(--surface-2) 1px, var(--surface-3) 1px, var(--surface-3) 40px)',
                    borderRadius: 8,
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
                    style={{
                      position: 'absolute',
                      left: `${trimPct.start}%`,
                      top: 0, bottom: 0, width: 10,
                      background: 'var(--ink)',
                      borderRadius: '4px 0 0 4px',
                      cursor: 'ew-resize',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transform: 'translateX(-5px)',
                    }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      isDraggingTrim.current = 'start'
                      const onMove = (me: MouseEvent) => {
                        const rect = (e.currentTarget as HTMLElement).closest('[data-timeline]')?.getBoundingClientRect()
                        if (!rect) return
                        const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
                        const t = pct * spec.duration
                        setSpec(s => ({ ...s, trimStart: Math.min(t, s.trimEnd - 0.1) }))
                      }
                      const onUp = () => { isDraggingTrim.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                  >
                    <svg width="4" height="12" viewBox="0 0 4 12" fill="none"><rect x="0.5" y="0" width="1" height="12" rx="0.5" fill="white" opacity="0.6"/><rect x="2.5" y="0" width="1" height="12" rx="0.5" fill="white" opacity="0.6"/></svg>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      left: `${trimPct.end}%`,
                      top: 0, bottom: 0, width: 10,
                      background: 'var(--ink)',
                      borderRadius: '0 4px 4px 0',
                      cursor: 'ew-resize',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transform: 'translateX(-5px)',
                    }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      const onMove = (me: MouseEvent) => {
                        const rect = (e.currentTarget as HTMLElement).closest('[data-timeline]')?.getBoundingClientRect()
                        if (!rect) return
                        const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
                        const t = pct * spec.duration
                        setSpec(s => ({ ...s, trimEnd: Math.max(t, s.trimStart + 0.1) }))
                      }
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                  >
                    <svg width="4" height="12" viewBox="0 0 4 12" fill="none"><rect x="0.5" y="0" width="1" height="12" rx="0.5" fill="white" opacity="0.6"/><rect x="2.5" y="0" width="1" height="12" rx="0.5" fill="white" opacity="0.6"/></svg>
                  </div>

                  {/* Playhead */}
                  <div style={{
                    position: 'absolute',
                    left: `${trimPct.cursor}%`,
                    top: -4, bottom: -4, width: 2,
                    background: 'var(--ink)',
                    pointerEvents: 'none',
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, background: 'var(--ink)', borderRadius: '50%' }} />
                  </div>

                  {/* Overlay marker ticks */}
                  {spec.overlays.map(o => (
                    <div key={o.id} style={{
                      position: 'absolute',
                      left: `${(o.start / spec.duration) * 100}%`,
                      width: `${(o.duration / spec.duration) * 100}%`,
                      top: '60%', height: '30%',
                      background: 'rgba(26,26,23,0.25)',
                      borderRadius: 2,
                      pointerEvents: 'none',
                    }} />
                  ))}
                  {/* Image overlay ticks */}
                  {(spec.imageOverlays ?? []).map(o => (
                    <div key={`img-${o.id}`} style={{
                      position: 'absolute',
                      left: `${(o.start / spec.duration) * 100}%`,
                      width: `${(o.duration / spec.duration) * 100}%`,
                      top: '30%', height: '30%',
                      background: 'rgba(77,159,255,0.4)',
                      borderRadius: 2,
                      pointerEvents: 'none',
                    }} />
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
                        ? <><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />Transcribing…</>
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
                    {spec.overlays.map(o => (
                      <div key={o.id} style={{ ...S.overlayCard, marginBottom: 8 }}>
                        {/* Color dot */}
                        <div style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: o.color ?? '#ffffff',
                          border: '1px solid var(--border)',
                          flexShrink: 0,
                        }} />
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, color: 'var(--ink-dim)' }}>
                          T
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.text}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{fmt(o.start)} – {fmt(o.start + o.duration)} · {o.position}</div>
                        </div>
                        <button onClick={() => pushHistory({ ...spec, overlays: spec.overlays.filter(x => x.id !== o.id) })} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
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
              </>
            )}

            {/* ── Music ─────────────────────────────────────────────────── */}
            {activePanel === 'music' && (
              <>
                <div style={S.sectionLabel}>Background Track</div>
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
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: (['var(--surface-2)', 'var(--surface-3)', 'var(--accent-soft)'] as const)[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {['🎵', '🎶', '🎸'][i]}
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
                  Rendered via Shotstack — full quality MP4, takes 30–60s.
                </div>

                <button
                  style={{ ...S.primaryBtn, opacity: exporting ? 0.6 : 1 }}
                  disabled={exporting}
                  onClick={handleExport}
                >
                  {exporting ? exportStatus || 'Rendering...' : '↗ Export Video'}
                </button>

                {exportUrl && (
                  <a
                    href={exportUrl}
                    download
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--ink)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download MP4
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
