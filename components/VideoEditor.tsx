'use client'

import { useState, useRef } from 'react'
import { EditSpec, TextOverlay, EMPTY_EDIT_SPEC, MUSIC_LIBRARY } from '@/lib/edit-spec'
import { getSupabase } from '@/lib/auth'

interface VideoEditorProps {
  initialVideoUrl: string
  initialDuration: number
  initialAspect: '9:16' | '1:1' | '16:9'
}

type Panel = 'trim' | 'text' | 'music' | 'ai' | 'export'

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

export default function VideoEditor({ initialVideoUrl, initialDuration, initialAspect }: VideoEditorProps) {
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
  const [exportStatus, setExportStatus] = useState<string>('')
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [activePanel, setActivePanel] = useState<Panel>('trim')
  const videoRef = useRef<HTMLVideoElement>(null)

  // New overlay form state
  const [newText, setNewText] = useState('')
  const [newStart, setNewStart] = useState(0)
  const [newDuration, setNewDuration] = useState(3)
  const [newPosition, setNewPosition] = useState<TextOverlay['position']>('bottom')
  const [newStyle, setNewStyle] = useState<TextOverlay['style']>('bold-white')

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
    const overlay: TextOverlay = {
      id: genId(),
      text: newText.trim(),
      start: newStart,
      duration: newDuration,
      position: newPosition,
      style: newStyle,
    }
    setSpec(s => ({ ...s, overlays: [...s.overlays, overlay] }))
    setNewText('')
    setNewStart(0)
    setNewDuration(3)
  }

  function removeOverlay(id: string) {
    setSpec(s => ({ ...s, overlays: s.overlays.filter(o => o.id !== id) }))
  }

  const aspectStyle =
    spec.aspectRatio === '9:16' ? '9/16' :
    spec.aspectRatio === '1:1' ? '1/1' :
    '16/9'

  const tabs: { id: Panel; label: string }[] = [
    { id: 'trim', label: 'Trim' },
    { id: 'text', label: 'Text' },
    { id: 'music', label: 'Music' },
    { id: 'ai', label: 'AI' },
    { id: 'export', label: 'Export' },
  ]

  return (
    <div style={{ display: 'flex', gap: 24, padding: '24px', minHeight: '80vh', alignItems: 'flex-start' }}>
      {/* Left: video preview + timeline */}
      <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Video Editor</h2>

        {/* Video preview */}
        <div style={{
          position: 'relative',
          background: '#000',
          borderRadius: 12,
          overflow: 'hidden',
          aspectRatio: aspectStyle,
          maxHeight: 500,
          alignSelf: 'flex-start',
          width: spec.aspectRatio === '9:16' ? 'auto' : '100%',
        }}>
          {spec.videoUrl ? (
            <video
              ref={videoRef}
              src={spec.videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={e => {
                if (spec.duration === 0) setSpec(s => ({ ...s, duration: e.currentTarget.duration, trimEnd: e.currentTarget.duration }))
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', fontSize: 14 }}>
              No video loaded
            </div>
          )}

          {/* Text overlay previews */}
          {spec.overlays
            .filter(o => currentTime >= o.start && currentTime < o.start + o.duration)
            .map(o => (
              <div key={o.id} style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: o.position === 'top' ? '10%' : o.position === 'center' ? '45%' : '80%',
                textAlign: 'center',
                color: '#fff',
                fontSize: 18,
                fontWeight: 700,
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                padding: '0 16px',
                pointerEvents: 'none',
              }}>
                {o.text}
              </div>
            ))}
        </div>

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-primary"
            style={{ minWidth: 80 }}
            onClick={() => { videoRef.current?.[isPlaying ? 'pause' : 'play']() }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontVariantNumeric: 'tabular-nums' }}>
            {currentTime.toFixed(1)}s / {spec.duration.toFixed(1)}s
          </span>
        </div>

        {/* Timeline scrubber */}
        <div>
          <input
            type="range"
            min={0}
            max={spec.duration || 1}
            step={0.1}
            value={currentTime}
            onChange={e => {
              const t = parseFloat(e.target.value)
              setCurrentTime(t)
              if (videoRef.current) videoRef.current.currentTime = t
            }}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />

          {/* Trim zone visual */}
          {spec.duration > 0 && (
            <div style={{ position: 'relative', height: 8, background: 'var(--surface-2)', borderRadius: 4, marginTop: 8 }}>
              <div style={{
                position: 'absolute',
                left: `${(spec.trimStart / spec.duration) * 100}%`,
                width: `${((spec.trimEnd - spec.trimStart) / spec.duration) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 4,
                opacity: 0.7,
              }} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
            <span>Trim in: {spec.trimStart.toFixed(1)}s</span>
            <span>Trim out: {spec.trimEnd.toFixed(1)}s</span>
          </div>
        </div>

        {/* Aspect ratio selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['9:16', '1:1', '16:9'] as const).map(ar => (
            <button
              key={ar}
              onClick={() => setSpec(s => ({ ...s, aspectRatio: ar }))}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: spec.aspectRatio === ar ? 'var(--accent)' : 'var(--surface-2)',
                color: spec.aspectRatio === ar ? '#fff' : 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {ar}
            </button>
          ))}
        </div>
      </div>

      {/* Right: panels */}
      <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Tab row */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 13,
                fontWeight: activePanel === tab.id ? 700 : 400,
                background: 'none',
                border: 'none',
                borderBottom: activePanel === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activePanel === tab.id ? 'var(--accent)' : 'var(--ink-dim)',
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Trim panel */}
        {activePanel === 'trim' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--ink-dim)', display: 'block', marginBottom: 6 }}>
                Trim in: <strong>{spec.trimStart.toFixed(1)}s</strong>
              </label>
              <input
                type="range"
                min={0}
                max={spec.duration || 1}
                step={0.1}
                value={spec.trimStart}
                onChange={e => setSpec(s => ({ ...s, trimStart: Math.min(parseFloat(e.target.value), s.trimEnd - 0.1) }))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--ink-dim)', display: 'block', marginBottom: 6 }}>
                Trim out: <strong>{spec.trimEnd.toFixed(1)}s</strong>
              </label>
              <input
                type="range"
                min={0}
                max={spec.duration || 1}
                step={0.1}
                value={spec.trimEnd}
                onChange={e => setSpec(s => ({ ...s, trimEnd: Math.max(parseFloat(e.target.value), s.trimStart + 0.1) }))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>
              Duration after trim: <strong>{Math.max(0, spec.trimEnd - spec.trimStart).toFixed(1)}s</strong>
            </p>
          </div>
        )}

        {/* Text Overlays panel */}
        {activePanel === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Existing overlays */}
            {spec.overlays.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>No text overlays yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {spec.overlays.map(o => (
                  <div key={o.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{o.start.toFixed(1)}s – {(o.start + o.duration).toFixed(1)}s · {o.position} · {o.style}</div>
                    </div>
                    <button
                      onClick={() => removeOverlay(o.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add overlay form */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Add overlay</div>
              <input
                type="text"
                placeholder="Text content"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4 }}>Start (s)</label>
                  <input
                    type="number"
                    min={0}
                    max={spec.duration}
                    step={0.1}
                    value={newStart}
                    onChange={e => setNewStart(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4 }}>Duration (s)</label>
                  <input
                    type="number"
                    min={0.5}
                    max={spec.duration}
                    step={0.1}
                    value={newDuration}
                    onChange={e => setNewDuration(parseFloat(e.target.value) || 1)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4 }}>Position</label>
                  <select
                    value={newPosition}
                    onChange={e => setNewPosition(e.target.value as TextOverlay['position'])}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
                  >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4 }}>Style</label>
                  <select
                    value={newStyle}
                    onChange={e => setNewStyle(e.target.value as TextOverlay['style'])}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
                  >
                    <option value="bold-white">Bold White</option>
                    <option value="minimal">Minimal</option>
                    <option value="caption">Caption</option>
                  </select>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={addOverlay}
                disabled={!newText.trim()}
                style={{ width: '100%' }}
              >
                Add Overlay
              </button>
            </div>
          </div>
        )}

        {/* Music panel */}
        {activePanel === 'music' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 4 }}>Choose a background track:</div>

            {/* No music option */}
            <div
              onClick={() => setSpec(s => ({ ...s, music: undefined }))}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${!spec.music ? 'var(--accent)' : 'var(--border)'}`,
                background: !spec.music ? 'var(--accent-soft, var(--surface-2))' : 'var(--surface-2)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            >
              No music
            </div>

            {/* Music library */}
            {MUSIC_LIBRARY.map(track => (
              <div
                key={track.url}
                onClick={() => setSpec(s => ({ ...s, music: { ...track, volume: s.music?.volume ?? track.volume } }))}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${spec.music?.url === track.url ? 'var(--accent)' : 'var(--border)'}`,
                  background: spec.music?.url === track.url ? 'var(--accent-soft, var(--surface-2))' : 'var(--surface-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{track.label}</div>
                </div>
                {spec.music?.url === track.url && (
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                )}
              </div>
            ))}

            {/* Volume slider */}
            {spec.music && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--ink-dim)', display: 'block', marginBottom: 6 }}>
                  Volume: <strong>{Math.round((spec.music.volume ?? 0.25) * 100)}%</strong>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={spec.music.volume ?? 0.25}
                  onChange={e => setSpec(s => s.music ? { ...s, music: { ...s.music, volume: parseFloat(e.target.value) } } : s)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
            )}
          </div>
        )}

        {/* AI Edit panel */}
        {activePanel === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
              Describe the edit you want to make in plain language.
            </div>
            <textarea
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              placeholder={'Describe your edit...\n\nExamples:\n• "Cut the last 2 seconds"\n• "Add a bold text hook at the start: POV you just discovered this"\n• "Add upbeat music at 30% volume"'}
              rows={7}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <button
              disabled={aiLoading || !aiInput.trim()}
              onClick={handleAiEdit}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {aiLoading ? 'Applying...' : 'Apply AI Edit'}
            </button>
          </div>
        )}

        {/* Export panel */}
        {activePanel === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0 }}>
              Renders via Shotstack — takes ~30–60s. Final MP4 at full quality.
            </p>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', background: 'var(--surface-2)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--ink)' }}>Render summary</div>
              <div>Aspect ratio: {spec.aspectRatio}</div>
              <div>Trimmed: {spec.trimStart.toFixed(1)}s → {spec.trimEnd.toFixed(1)}s ({(spec.trimEnd - spec.trimStart).toFixed(1)}s)</div>
              <div>Text overlays: {spec.overlays.length}</div>
              <div>Music: {spec.music ? `${spec.music.label} (${Math.round(spec.music.volume * 100)}%)` : 'None'}</div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? exportStatus || 'Rendering...' : 'Export Video'}
            </button>
            {exportUrl && (
              <a
                href={exportUrl}
                download
                style={{ display: 'block', marginTop: 4, textAlign: 'center', fontSize: 13, color: 'var(--accent)' }}
              >
                Download MP4
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
