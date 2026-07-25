'use client'

// Scene Studio — reusable AI-rendered environments (café, gym, beach, loft,
// street…) that appear as picker options in the Influencer Studio composer
// and the UGC Package Builder. Users create a Scene once from a text
// description and/or reference photos; NB Pro renders an empty hero of the
// place; downstream shoots use it as a location anchor.

import { useEffect, useState, type CSSProperties } from 'react'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { compressImageFile, type CompressedImage } from '@/lib/image-compress'
import { useImageDrop } from '@/hooks/useImageDrop'
import { Loader2, Trash2, Sparkles, ArrowLeft, ImagePlus, X } from 'lucide-react'
import { SectionTabs, STUDIOS_TABS } from '@/components/SectionTabs'

interface Scene {
  id: string
  name: string
  category?: string | null
  description?: string | null
  scene_prompt: string
  hero_image_url: string | null
  created_at: string
  last_used_at?: string | null
}

const chip = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
  background: active ? 'var(--ink)' : 'var(--surface)',
  color: active ? 'var(--on-ink)' : 'var(--ink-2)',
  transition: 'all 0.12s',
})

async function getToken(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export default function ScenesStudio() {
  const [list, setList] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Scene | null>(null)

  // Create composer state.
  const [showCreate, setShowCreate] = useState(false)
  const [createDescription, setCreateDescription] = useState('')
  const [createModel, setCreateModel] = useState<'pro' | 'nb2'>('pro')
  const [createRefs, setCreateRefs] = useState<CompressedImage[]>([])
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; label?: string } | null>(null)

  const createRefsDrop = useImageDrop({
    onFiles: async files => {
      for (const f of files.slice(0, 3 - createRefs.length)) {
        try {
          const compressed = await compressImageFile(f, 1400, 0.85)
          setCreateRefs(prev => prev.length < 3 ? [...prev, compressed] : prev)
        } catch { showError('Image failed', `Could not read ${f.name}`) }
      }
    },
    disabled: createRefs.length >= 3,
  })

  useEffect(() => { load() }, [])
  async function load() {
    try {
      setLoading(true)
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/scenes', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setList(data.scenes ?? [])
    } catch {
      /* toast noise on first load is worse than silence */
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    if (createDescription.trim().length < 5 && !createRefs.length) {
      showError('Describe the scene', 'Type a description or attach a reference photo')
      return
    }
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          description: createDescription.trim() || undefined,
          model: createModel,
          referenceImages: createRefs.map(r => ({ base64: r.base64, mimeType: r.mimeType })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scene creation failed')
      setList(prev => [data.scene, ...prev])
      setCreateDescription('')
      setCreateRefs([])
      setShowCreate(false)
      showSuccess('Scene created', `${data.scene.name} · ${data.creditsCharged} cr`)
    } catch (err) {
      showError('Creation failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setCreating(false)
    }
  }

  async function remove(scene: Scene) {
    if (!confirm(`Delete "${scene.name}"?`)) return
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/scenes/${scene.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Delete failed')
      setList(prev => prev.filter(s => s.id !== scene.id))
      if (selected?.id === scene.id) setSelected(null)
    } catch (err) {
      showError('Delete failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="content" style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionTabs tabs={STUDIOS_TABS} />
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="page-meta"><span>Studio</span><span>/</span><span>Scenes</span></div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, margin: 0, lineHeight: 1.1 }}>Scene <em>Studio</em></h1>
          <p style={{ fontSize: 14, color: 'var(--ink-dim)', maxWidth: 640, marginTop: 8 }}>
            Build the places your shoots happen in — the café, the loft, the studio, the street.
            Reuse them anywhere in the app the way you reuse products and influencers.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary"
            style={{ padding: '11px 18px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Sparkles size={15} /> New scene
          </button>
        )}
      </div>

      {/* Create composer */}
      {showCreate && (
        <div style={{ padding: 20, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>Describe the scene</span>
            <button onClick={() => setShowCreate(false)} title="Cancel" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <textarea
            className="textarea"
            rows={3}
            value={createDescription}
            onChange={e => setCreateDescription(e.target.value)}
            placeholder="e.g. A warm-lit Brooklyn corner café — exposed brick, small marble tables, jazz record covers on the walls, late-afternoon light through big windows."
            style={{ fontSize: 14, resize: 'vertical', margin: 0 }}
          />

          {/* Reference photos */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {createRefs.map((r, i) => (
              <div key={i} style={{ position: 'relative', width: 74, height: 74, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.preview} alt={`ref ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => setCreateRefs(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 2, right: 2, width: 17, height: 17, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0 }}
                >×</button>
              </div>
            ))}
            {createRefs.length < 3 && (
              <>
                <input
                  id="sceneRefInput"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const files = Array.from(e.target.files ?? []).slice(0, 3 - createRefs.length)
                    e.target.value = ''
                    for (const f of files) {
                      try {
                        const compressed = await compressImageFile(f, 1400, 0.85)
                        setCreateRefs(prev => prev.length < 3 ? [...prev, compressed] : prev)
                      } catch { showError('Image failed', `Could not read ${f.name}`) }
                    }
                  }}
                />
                <button
                  onClick={() => document.getElementById('sceneRefInput')?.click()}
                  {...createRefsDrop.dropzoneProps}
                  style={{ width: 74, height: 74, borderRadius: 10, border: `1.5px dashed ${createRefsDrop.isDragging ? 'var(--ink)' : 'var(--border)'}`, background: createRefsDrop.isDragging ? 'var(--hover)' : 'var(--surface-2, var(--surface))', color: createRefsDrop.isDragging ? 'var(--ink)' : 'var(--ink-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms, border-color 120ms, color 120ms' }}
                  title="Attach up to 3 reference photos — the scene will be based on them"
                >
                  <ImagePlus size={20} />
                </button>
              </>
            )}
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', maxWidth: 260, lineHeight: 1.4 }}>Optional: up to 3 reference photos — the AI matches this exact place.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setCreateModel('nb2')} style={chip(createModel === 'nb2')}>NB2 · 4 cr</button>
              <button onClick={() => setCreateModel('pro')} style={chip(createModel === 'pro')}>NB Pro · 6 cr</button>
            </div>
            <button
              onClick={create}
              disabled={creating}
              className="btn btn-primary"
              style={{ marginLeft: 'auto', padding: '11px 22px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {creating ? 'Building the scene…' : 'Create scene'}
            </button>
          </div>
        </div>
      )}

      {/* Roster */}
      {loading ? (
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--ink-mute)' }} />
      ) : list.length === 0 && !showCreate ? (
        <div style={{ padding: '54px 20px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13.5, border: '1px dashed var(--border)', borderRadius: 14 }}>
          No scenes yet — hit &ldquo;New scene&rdquo; and describe a place. It becomes a reusable environment for every shoot.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {list.map(s => (
            <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <button
                onClick={() => setLightbox({ url: s.hero_image_url ?? '', label: s.name })}
                style={{ padding: 0, background: 'transparent', border: 0, cursor: 'zoom-in' }}
              >
                {s.hero_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.hero_image_url} alt={s.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                )}
              </button>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17 }}>{s.name}</span>
                  {s.category && <span style={{ fontSize: 10.5, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.category}</span>}
                </div>
                {s.description && <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.45 }}>{s.description}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                  <button
                    onClick={() => setSelected(selected?.id === s.id ? null : s)}
                    style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer' }}
                  >
                    {selected?.id === s.id ? 'Hide prompt' : 'View prompt'}
                  </button>
                  <button
                    onClick={() => remove(s)}
                    disabled={deleting}
                    style={{ marginLeft: 'auto', fontSize: 11.5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-mute)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
                {selected?.id === s.id && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'var(--surface-2, var(--hover))', fontSize: 11.5, color: 'var(--ink-dim)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                    {s.scene_prompt}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && lightbox.url && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: 10, borderRadius: '50%', cursor: 'pointer' }}>
            <ArrowLeft size={16} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={lightbox.label} style={{ maxWidth: '92vw', maxHeight: '82vh', borderRadius: 12 }} />
          {lightbox.label && <div style={{ marginTop: 12, color: '#fff', fontSize: 13.5 }}>{lightbox.label}</div>}
        </div>
      )}
    </main>
  )
}
