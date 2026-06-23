'use client'

import { useState, useRef, useCallback } from 'react'
import { EditSpec, TextOverlay, EMPTY_EDIT_SPEC, MUSIC_LIBRARY } from '@/lib/edit-spec'
import { getSupabase } from '@/lib/auth'

interface VideoEditorProps {
  initialVideoUrl?: string
  initialDuration?: number
  initialAspect?: '9:16' | '1:1' | '16:9'
}

type Panel = 'trim' | 'text' | 'music' | 'ai' | 'export'

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
  { id: 'music',  icon: '♪',  label: 'Music'  },
  { id: 'ai',     icon: '✦',  label: 'AI'     },
  { id: 'export', icon: '↗',  label: 'Export' },
]

export default function VideoEditor({ initialVideoUrl = '', initialDuration = 0, initialAspect = '9:16' }: VideoEditorProps) {
  const [spec, setSpec] = useState<EditSpec>({
    ...EMPTY_EDIT_SPEC,
    videoUrl: initialVideoUrl,
    duration: initialDuration,
    aspectRatio: initialAspect,
    trimEnd: initialDuration,
  })
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
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const isDraggingTrim = useRef<null | 'start' | 'end'>(null)
  const draggingOverlay = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  function loadVideoFile(file: File) {
    const url = URL.createObjectURL(file)
    setSpec(s => ({ ...s, videoUrl: url, duration: 0, trimStart: 0, trimEnd: 0 }))
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
      const res = await fetch('/api/video/editor-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spec }),
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
      setSpec(newSpec)
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
    setSpec(s => ({
      ...s,
      overlays: [...s.overlays, { id: genId(), text: newText.trim(), start: newStart, duration: newDuration, position: newPosition, style: newStyle, x: 0.5, y: defaultY }],
    }))
    setNewText('')
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

    function onMove(me: MouseEvent) {
      if (!draggingOverlay.current || !rect) return
      const dx = (me.clientX - draggingOverlay.current.startX) / rect.width
      const dy = (me.clientY - draggingOverlay.current.startY) / rect.height
      const newX = Math.max(0, Math.min(1, draggingOverlay.current.origX + dx))
      const newY = Math.max(0, Math.min(1, draggingOverlay.current.origY + dy))
      setSpec(s => ({
        ...s,
        overlays: s.overlays.map(o => o.id === draggingOverlay.current!.id ? { ...o, x: newX, y: newY } : o),
      }))
    }
    function onUp() {
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
    },
    tab: (active: boolean) => ({
      flex: 1,
      padding: '14px 0 12px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: 3,
      fontSize: 10,
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
    tabIcon: { fontSize: 16 },
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
  }

  return (
    <div style={S.root}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={S.topBar}>
        <span style={S.title}>
          <span style={{ color: 'var(--ink)', marginRight: 8 }}>▶</span>
          Video Editor
        </span>

        {/* Aspect ratio */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['9:16', '1:1', '16:9'] as const).map(ar => (
            <button key={ar} onClick={() => setSpec(s => ({ ...s, aspectRatio: ar }))} style={S.arBtn(spec.aspectRatio === ar)}>
              {ar}
            </button>
          ))}
        </div>

        {/* Upload */}
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileInput} style={{ display: 'none' }} />
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
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
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
                const yPct = (o.y ?? (o.position === 'top' ? 12 : o.position === 'center' ? 50 : 82))
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
                      color: '#fff',
                      fontSize: o.style === 'caption' ? 13 : 18,
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
                      onChange={e => setSpec(s => ({ ...s, trimStart: Math.min(parseFloat(e.target.value), s.trimEnd - 0.1) }))}
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
                      onChange={e => setSpec(s => ({ ...s, trimEnd: Math.max(parseFloat(e.target.value), s.trimStart + 0.1) }))}
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
                  onClick={() => setSpec(s => ({ ...s, trimStart: 0, trimEnd: s.duration }))}
                >
                  Reset trim
                </button>
              </>
            )}

            {/* ── Text overlays ─────────────────────────────────────────── */}
            {activePanel === 'text' && (
              <>
                {spec.overlays.length > 0 && (
                  <div>
                    <div style={S.sectionLabel}>Active Overlays</div>
                    {spec.overlays.map(o => (
                      <div key={o.id} style={{ ...S.overlayCard, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, color: 'var(--ink-dim)' }}>
                          T
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.text}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{fmt(o.start)} – {fmt(o.start + o.duration)} · {o.position} · {o.style}</div>
                        </div>
                        <button onClick={() => setSpec(s => ({ ...s, overlays: s.overlays.filter(x => x.id !== o.id) }))} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
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
                          <option value="bold-white">Bold White</option>
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

            {/* ── Music ─────────────────────────────────────────────────── */}
            {activePanel === 'music' && (
              <>
                <div style={S.sectionLabel}>Background Track</div>
                <div
                  style={S.musicCard(!spec.music)}
                  onClick={() => setSpec(s => ({ ...s, music: undefined }))}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔇</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-dim)' }}>No music</div>
                  {!spec.music && <span style={{ marginLeft: 'auto', color: 'var(--ink)', fontSize: 16 }}>✓</span>}
                </div>

                {MUSIC_LIBRARY.map((track, i) => (
                  <div
                    key={track.url}
                    style={S.musicCard(spec.music?.url === track.url)}
                    onClick={() => setSpec(s => ({ ...s, music: { ...track, volume: s.music?.volume ?? track.volume } }))}
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
                      onChange={e => setSpec(s => s.music ? { ...s, music: { ...s.music, volume: parseFloat(e.target.value) } } : s)}
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
                    {[
                      'Cut the last 2 seconds',
                      'Add a bold hook at the start',
                      'Add upbeat music at 30% volume',
                    ].map(ex => (
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
                  {aiLoading ? '✦ Applying...' : '✦ Apply AI Edit'}
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
