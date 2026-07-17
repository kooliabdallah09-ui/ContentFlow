'use client'

// Influencer Studio — create persistent AI characters, shoot photos of
// them anywhere, and send them into the UGC pipeline. Admin-gated.

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { canAccessInfluencerStudio } from '@/lib/pov-access'
import { showError, showSuccess } from '@/lib/notifications'
import { Loader2, Trash2, Camera, Clapperboard, Sparkles, ArrowLeft, ImagePlus, X } from 'lucide-react'
import { compressImageFile, type CompressedImage } from '@/lib/image-compress'

interface Influencer {
  id: string
  name: string
  handle?: string | null
  bio?: string | null
  personality?: string | null
  niche?: string | null
  portrait_url: string
  character_sheet_url?: string | null
  created_at: string
}

interface Photo {
  id: string
  scene: string
  image_url: string
  created_at: string
}

const SCENE_PRESETS = [
  'sunny beach at golden hour',
  'cozy café with a latte',
  'city street at night, neon lights',
  'gym mid-workout',
  'reading nook at home, warm lamp light',
  'rooftop party at dusk',
  'farmers market picking produce',
  'hiking trail with mountain views',
]

const traitLabel: CSSProperties = {
  fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--ink-2)', marginBottom: 8,
}
const traitInput: CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--ink)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
}
const chip = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
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

export default function InfluencersPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [list, setList] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [refImages, setRefImages] = useState<CompressedImage[]>([])
  // Structured identity traits — every selected one is a hard lock the AI
  // must honor. All optional; description covers anything not chippable.
  const [traitName, setTraitName] = useState('')
  const [traitGender, setTraitGender] = useState('')
  const [traitAge, setTraitAge] = useState('')
  const [traitStyles, setTraitStyles] = useState<string[]>([])
  const [traitHair, setTraitHair] = useState('')
  const [traitEyes, setTraitEyes] = useState('')
  const [traitHairstyle, setTraitHairstyle] = useState('')
  const [traitEthnicity, setTraitEthnicity] = useState('')
  // 'traits' = structured pickers; 'describe' = the original freeform-only box
  const [createMode, setCreateMode] = useState<'traits' | 'describe'>('traits')
  const [traitFeatures, setTraitFeatures] = useState<string[]>([])
  const [createModel, setCreateModel] = useState<'pro' | 'nb2'>('pro')

  // Detail
  const [selected, setSelected] = useState<Influencer | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [scene, setScene] = useState('')
  const [sceneImages, setSceneImages] = useState<CompressedImage[]>([])
  const [shotCount, setShotCount] = useState(2)
  const [ratio, setRatio] = useState<'9:16' | '4:5' | '1:1' | '16:9'>('4:5')
  const [shootModel, setShootModel] = useState<'pro' | 'nb2'>('pro')
  const [shooting, setShooting] = useState(false)
  const [bridging, setBridging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sheetLoading, setSheetLoading] = useState(false)
  // In-app lightbox for viewing photos (no more raw-URL tabs).
  const [lightbox, setLightbox] = useState<{ url: string; label?: string } | null>(null)

  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) { setAllowed(false); return }
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email
      const ok = canAccessInfluencerStudio(email)
      setAllowed(ok)
      if (!ok) { router.push('/dashboard'); return }
      await load()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/influencers', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setList(data.influencers ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    const hasTraits = createMode === 'traits' && !!(traitGender || traitAge || traitStyles.length || traitHair || traitEyes || traitHairstyle || traitFeatures.length || traitEthnicity)
    if (description.trim().length < 10 && !hasTraits) {
      showError('Nothing to work with', createMode === 'traits' ? 'Pick some traits or add details' : 'Describe your influencer in at least a sentence')
      return
    }
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          description: description.trim(),
          name: traitName.trim() || undefined,
          gender: createMode === 'traits' ? (traitGender || undefined) : undefined,
          ageRange: createMode === 'traits' ? (traitAge || undefined) : undefined,
          styles: createMode === 'traits' ? traitStyles : [],
          hairColor: createMode === 'traits' ? (traitHair || undefined) : undefined,
          eyeColor: createMode === 'traits' ? (traitEyes || undefined) : undefined,
          ethnicity: createMode === 'traits' ? (traitEthnicity || undefined) : undefined,
          hairstyle: createMode === 'traits' ? (traitHairstyle || undefined) : undefined,
          faceFeatures: createMode === 'traits' ? traitFeatures : [],
          model: createModel,
          referenceImages: refImages.map(r => ({ base64: r.base64, mimeType: r.mimeType })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Creation failed')
      setList(prev => [data.influencer, ...prev])
      setDescription('')
      setRefImages([])
      setTraitName(''); setTraitGender(''); setTraitAge(''); setTraitStyles([]); setTraitHair(''); setTraitEyes(''); setTraitHairstyle(''); setTraitFeatures([]); setTraitEthnicity('')
      showSuccess('Influencer created', `${data.influencer.name} is ready.`)
      openDetail(data.influencer)
    } catch (err) {
      showError('Creation failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setCreating(false)
    }
  }

  async function openDetail(inf: Influencer) {
    setSelected(inf)
    setPhotos([])
    const token = await getToken()
    if (!token) return
    const res = await fetch(`/api/influencers/${inf.id}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) {
      setPhotos(data.photos ?? [])
      if (data.influencer) setSelected(data.influencer)
    }
  }

  async function generateSheet() {
    if (!selected) return
    setSheetLoading(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/influencers/${selected.id}/character-sheet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sheet generation failed')
      setSelected(prev => prev ? { ...prev, character_sheet_url: data.characterSheetUrl } : prev)
      showSuccess('Character sheet ready', `Multi-angle reference generated · ${data.creditsCharged} cr`)
    } catch (err) {
      showError('Sheet failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setSheetLoading(false)
    }
  }

  async function photoshoot() {
    if (!selected || scene.trim().length < 3) {
      showError('No scene', 'Pick a preset or describe where the photos happen')
      return
    }
    setShooting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/influencers/${selected.id}/photoshoot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scene: scene.trim(),
          count: shotCount,
          ratio,
          model: shootModel,
          sceneImages: sceneImages.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Photoshoot failed')
      setPhotos(prev => [...data.photos, ...prev])
      showSuccess('Photoshoot done', `${data.photos.length} photo${data.photos.length > 1 ? 's' : ''} · ${data.creditsCharged} cr`)
    } catch (err) {
      showError('Photoshoot failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setShooting(false)
    }
  }

  async function useInUgc() {
    if (!selected) return
    setBridging(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/influencers/${selected.id}/use-in-ugc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      showSuccess('Ready for UGC', `${selected.name} now appears in the UGC character step.`)
      router.push('/generate/ugc')
    } catch (err) {
      showError('Failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setBridging(false)
    }
  }

  async function remove() {
    if (!selected) return
    if (!confirm(`Delete ${selected.name} and all their photos?`)) return
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/influencers/${selected.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setList(prev => prev.filter(i => i.id !== selected.id))
      setSelected(null)
      showSuccess('Deleted', 'Influencer removed.')
    } catch (err) {
      showError('Delete failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setDeleting(false)
    }
  }

  if (allowed === null) return null
  if (!allowed) return null

  // ── Detail view ──────────────────────────────────────────────────────
  if (selected) {
    const RATIOS = [
      { id: '9:16' as const, w: 12, h: 21 },
      { id: '4:5'  as const, w: 16, h: 20 },
      { id: '1:1'  as const, w: 18, h: 18 },
      { id: '16:9' as const, w: 24, h: 13.5 },
    ]
    return (
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 32px 24px', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)' }}>
        <button onClick={() => setSelected(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--ink-dim)', fontSize: 13.5, cursor: 'pointer', marginBottom: 20, padding: 0, alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> All influencers
        </button>

        {/* Identity card — horizontal 16:9-ish banner across the top */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.portrait_url} alt={selected.name} style={{ width: 220, minHeight: 250, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26 }}>{selected.name}</span>
              {selected.handle && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-dim)' }}>{selected.handle}</span>}
            </div>
            {selected.niche && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{selected.niche}</div>}
            {selected.bio && <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.55, margin: '4px 0 0' }}>{selected.bio}</p>}
            {selected.personality && <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>{selected.personality}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={useInUgc} disabled={bridging} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {bridging ? <Loader2 size={14} className="animate-spin" /> : <Clapperboard size={14} />} Use in UGC
              </button>
              {selected.character_sheet_url ? (
                <>
                  <button onClick={() => setLightbox({ url: selected.character_sheet_url!, label: 'Character sheet' })} style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer' }}>
                    View character sheet
                  </button>
                  <button onClick={generateSheet} disabled={sheetLoading} style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-mute)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {sheetLoading ? <Loader2 size={13} className="animate-spin" /> : null} Regenerate sheet · 10 cr
                  </button>
                </>
              ) : (
                <button onClick={generateSheet} disabled={sheetLoading} style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, background: 'transparent', border: '1px dashed var(--border)', color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {sheetLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate character sheet · 10 cr
                </button>
              )}
              <button onClick={remove} disabled={deleting} style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-mute)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Gallery — center stage, bigger tiles */}
        <div style={{ flex: 1, marginBottom: 20 }}>
          {photos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {photos.map(p => (
                <button key={p.id} onClick={() => setLightbox({ url: p.image_url, label: p.scene })} title={p.scene} style={{ display: 'block', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', padding: 0, cursor: 'zoom-in', background: 'var(--surface)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt={p.scene} style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13.5, border: '1px dashed var(--border)', borderRadius: 14 }}>
              No photos yet — describe a scene below and hit Shoot.
            </div>
          )}
        </div>

        {/* Composer — pinned at the bottom like a chat input */}
        <div style={{ position: 'sticky', bottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {SCENE_PRESETS.map(p => (
              <button key={p} onClick={() => setScene(p)} style={{
                padding: '5px 11px', borderRadius: 999, fontSize: 11.5, cursor: 'pointer',
                border: `1px solid ${scene === p ? 'var(--ink)' : 'var(--border)'}`,
                background: scene === p ? 'var(--surface-2)' : 'var(--surface)',
                color: 'var(--ink-2)',
              }}>{p}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            {/* Attach */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              {sceneImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 44, height: 44, borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`ref ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setSceneImages(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 1, right: 1, width: 15, height: 15, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 9, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
              {sceneImages.length < 2 && (
                <>
                  <input id="sceneRefInput" type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={async e => {
                      const files = Array.from(e.target.files ?? []).slice(0, 2 - sceneImages.length)
                      e.target.value = ''
                      for (const f of files) {
                        try {
                          const compressed = await compressImageFile(f, 1200, 0.85)
                          setSceneImages(prev => prev.length < 2 ? [...prev, compressed] : prev)
                        } catch { showError('Image failed', `Could not read ${f.name}`) }
                      }
                    }}
                  />
                  <button onClick={() => document.getElementById('sceneRefInput')?.click()}
                    title="Attach an outfit, product, or location photo to include in the shots"
                    style={{ width: 44, height: 44, borderRadius: 9, border: '1.5px dashed var(--border)', background: 'var(--surface-2, var(--surface))', color: 'var(--ink-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ImagePlus size={16} />
                  </button>
                </>
              )}
            </div>

            {/* Scene input */}
            <textarea
              className="textarea"
              rows={2}
              value={scene}
              onChange={e => setScene(e.target.value)}
              placeholder="Describe any scene: 'walking through Tokyo in the rain with a clear umbrella'"
              style={{ fontSize: 13.5, flex: 1, resize: 'none', margin: 0 }}
            />

            {/* Shoot */}
            <button onClick={photoshoot} disabled={shooting} className="btn btn-primary" style={{ padding: '13px 20px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              {shooting ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Shoot
            </button>
          </div>

          {/* Format + count row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {RATIOS.map(r => {
                const active = ratio === r.id
                return (
                  <button key={r.id} onClick={() => setRatio(r.id)} title={r.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '6px 11px', borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? 'var(--on-ink)' : 'var(--ink-2)',
                  }}>
                    <span style={{ width: r.w, height: r.h, borderRadius: 2.5, border: `1.5px solid ${active ? 'var(--on-ink)' : 'var(--ink-mute)'}`, display: 'block' }} />
                    {r.id}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setShotCount(n)} style={{
                  width: 30, height: 30, borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                  border: `1px solid ${shotCount === n ? 'var(--ink)' : 'var(--border)'}`,
                  background: shotCount === n ? 'var(--ink)' : 'var(--surface)',
                  color: shotCount === n ? 'var(--on-ink)' : 'var(--ink-2)',
                  fontWeight: 600,
                }}>{n}</button>
              ))}
              <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{shotCount * (shootModel === 'nb2' ? 4 : 8)} cr</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setShootModel('pro')} title="Best identity fidelity" style={chip(shootModel === 'pro')}>Pro · 8 cr</button>
              <button onClick={() => setShootModel('nb2')} title="Cheaper — not as faithful to the face, can make small mistakes" style={chip(shootModel === 'nb2')}>NB2 · 4 cr · less accurate</button>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.label ?? 'photo'}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12, cursor: 'default' }}
            />
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, cursor: 'default' }}>
              {lightbox.label && <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{lightbox.label}</span>}
              <button
                onClick={async () => {
                  try {
                    const blob = await fetch(lightbox.url).then(r => r.blob())
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = (lightbox.label ?? 'photo').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60) + '.png'
                    a.click()
                  } catch { window.open(lightbox.url, '_blank') }
                }}
                style={{ padding: '8px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Download
              </button>
              <button
                onClick={() => setLightbox(null)}
                style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)', fontSize: 12.5, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    )
  }

  // ── List + create view ───────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '48px 32px' }}>
      <div style={{ marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>ADMIN · BETA</div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 400, margin: '0 0 6px' }}>Influencer <em>studio</em></h1>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '0 0 28px', maxWidth: 560, lineHeight: 1.6 }}>
        Describe a character once — get a persistent AI influencer with a face, a handle, and a personality. Shoot photos of them anywhere, or drop them into a UGC ad.
      </p>

      {/* Create box — structured identity picker */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 22, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Create new influencer</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>Define your AI persona&apos;s identity and visual style — every pick is locked in exactly.</div>
        </div>

        {/* Mode toggle: structured pickers vs the original freeform box */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCreateMode('traits')} style={chip(createMode === 'traits')}>Build with options</button>
          <button onClick={() => setCreateMode('describe')} style={chip(createMode === 'describe')}>Just describe them</button>
        </div>

        {createMode === 'traits' && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={traitLabel}>Name <span style={{ fontWeight: 400, color: 'var(--ink-mute)', textTransform: 'none', letterSpacing: 0 }}>· optional, AI invents one otherwise</span></div>
            <input type="text" value={traitName} onChange={e => setTraitName(e.target.value)} placeholder="e.g. Victor" style={traitInput} />
          </div>
          <div>
            <div style={traitLabel}>Gender</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Female', 'Male', 'Non-binary'].map(g => (
                <button key={g} onClick={() => setTraitGender(traitGender === g ? '' : g)} style={chip(traitGender === g)}>{g}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={traitLabel}>Age range</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['18-24', '25-30', '31-37', '38-45', '46-55', '56-65', '66-75', '76-85'].map(a => (
              <button key={a} onClick={() => setTraitAge(traitAge === a ? '' : a)} style={chip(traitAge === a)}>{a}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={traitLabel}>Style &amp; aesthetic <span style={{ fontWeight: 400, color: 'var(--ink-mute)', textTransform: 'none', letterSpacing: 0 }}>· pick any</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Luxury', 'Lifestyle', 'Fitness', 'Casual', 'Streetwear', 'Artistic', 'Corporate', 'Soft Girl', 'Edgy', 'Minimalist'].map(st => {
              const on = traitStyles.includes(st)
              return (
                <button key={st} onClick={() => setTraitStyles(prev => on ? prev.filter(x => x !== st) : [...prev, st])} style={chip(on)}>{st}</button>
              )
            })}
          </div>
        </div>

        <div>
          <div style={traitLabel}>Hair color</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['Black', '#1a1a1a'], ['Dark Brown', '#4a3220'], ['Light Brown', '#8b6b47'], ['Blonde', '#d9b380'],
              ['Platinum Blonde', '#e8ddc8'], ['Red', '#a83c1e'], ['Auburn', '#7a3b22'], ['Ginger', '#c26a34'],
              ['Grey', '#9a9a9a'], ['White', '#eeeeee'], ['Pink', '#e08bb0'], ['Blue', '#4a6fb5'],
            ] as const).map(([label, dot]) => (
              <button key={label} onClick={() => setTraitHair(traitHair === label ? '' : label)} style={chip(traitHair === label)}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'inline-block', marginRight: 6, border: '1px solid rgba(0,0,0,0.15)' }} />{label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={traitLabel}>Eye color</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['Brown', '#5c4023'], ['Dark Brown', '#3a2a18'], ['Hazel', '#8e7037'], ['Green', '#5a7d4f'],
              ['Blue', '#5b84b8'], ['Grey', '#8b939c'], ['Amber', '#c98d2e'], ['Black', '#191919'],
            ] as const).map(([label, dot]) => (
              <button key={label} onClick={() => setTraitEyes(traitEyes === label ? '' : label)} style={chip(traitEyes === label)}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'inline-block', marginRight: 6, border: '1px solid rgba(0,0,0,0.15)' }} />{label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={traitLabel}>Ethnicity</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['White / Caucasian', 'Black / African', 'Latina / Hispanic', 'East Asian', 'South Asian', 'Southeast Asian', 'Middle Eastern', 'Native American', 'Pacific Islander', 'Mixed'].map(e => (
              <button key={e} onClick={() => setTraitEthnicity(traitEthnicity === e ? '' : e)} style={chip(traitEthnicity === e)}>{e}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={traitLabel}>Hairstyle</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Long straight', 'Long wavy', 'Curly', 'Coily', 'Bob', 'Pixie cut', 'Shoulder-length', 'Ponytail', 'Messy bun', 'Braids', 'Slicked back', 'Buzz cut', 'Short textured', 'Man bun'].map(h => (
              <button key={h} onClick={() => setTraitHairstyle(traitHairstyle === h ? '' : h)} style={chip(traitHairstyle === h)}>{h}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={traitLabel}>Face features <span style={{ fontWeight: 400, color: 'var(--ink-mute)', textTransform: 'none', letterSpacing: 0 }}>· pick any</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Freckles', 'Dimples', 'Beauty mark', 'Rosy cheeks', 'High cheekbones', 'Strong jawline', 'Full lips', 'Glasses', 'Light stubble', 'Full beard', 'Gap teeth', 'Monolid eyes'].map(f => {
              const on = traitFeatures.includes(f)
              return (
                <button key={f} onClick={() => setTraitFeatures(prev => on ? prev.filter(x => x !== f) : (prev.length < 6 ? [...prev, f] : prev))} style={chip(on)}>{f}</button>
              )
            })}
          </div>
        </div>

        </>)}

        <div>
          <div style={traitLabel}>Image model</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setCreateModel('pro')} style={{ ...chip(createModel === 'pro'), flexDirection: 'column', alignItems: 'flex-start', borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ fontWeight: 700 }}>Nano Banana Pro</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>best identity fidelity · 20 cr</span>
            </button>
            <button onClick={() => setCreateModel('nb2')} style={{ ...chip(createModel === 'nb2'), flexDirection: 'column', alignItems: 'flex-start', borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ fontWeight: 700 }}>Nano Banana 2</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>cheaper · 12 cr · not as sharp, can make mistakes</span>
            </button>
          </div>
        </div>

        <div>
          <div style={traitLabel}>{createMode === 'traits' ? 'Additional details' : 'Describe your influencer'}</div>
          <textarea
            className="textarea"
            rows={createMode === 'traits' ? 3 : 4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={createMode === 'traits'
              ? 'Add any extra details: clothing, accessories, tattoos, makeup, vibe, what they post about…'
              : 'e.g. A laid-back surfer with sun-bleached curly hair and freckles who posts about sustainable skincare. Warm, a little sarcastic, always golden-hour lighting.'}
            style={{ fontSize: 14, margin: 0 }}
          />
        </div>

        {/* Reference images — the influencer's look is anchored to these */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {refImages.map((img, i) => (
            <div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt={`ref ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {refImages.length < 3 && (
            <>
              <input
                id="influencerRefInput"
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={async e => {
                  const files = Array.from(e.target.files ?? []).slice(0, 3 - refImages.length)
                  e.target.value = ''
                  for (const f of files) {
                    try {
                      const compressed = await compressImageFile(f, 1200, 0.85)
                      setRefImages(prev => prev.length < 3 ? [...prev, compressed] : prev)
                    } catch { showError('Image failed', `Could not read ${f.name}`) }
                  }
                }}
              />
              <button
                onClick={() => document.getElementById('influencerRefInput')?.click()}
                style={{ width: 56, height: 56, borderRadius: 10, border: '1.5px dashed var(--border)', background: 'var(--surface-2)', color: 'var(--ink-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Add reference photos (up to 3) — the influencer's face and look will be based on them"
              >
                <ImagePlus size={18} />
              </button>
            </>
          )}
          <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', maxWidth: 260, lineHeight: 1.4 }}>
            Optional: up to 3 reference photos — the face + look will be based on them.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{createModel === 'nb2' ? '12' : '20'} cr — identity sheet + portrait + turnaround</span>
          <button onClick={create} disabled={creating} className="btn btn-primary" style={{ padding: '11px 22px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {creating ? 'Casting…' : 'Create influencer'}
          </button>
        </div>
      </div>

      {/* Roster */}
      {loading ? (
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--ink-mute)' }} />
      ) : list.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--ink-mute)' }}>No influencers yet — describe your first one above.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {list.map(inf => (
            <button key={inf.id} onClick={() => openDetail(inf)} style={{
              textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14,
              overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer', padding: 0,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inf.portrait_url} alt={inf.name} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{inf.name}</div>
                {inf.handle && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 1 }}>{inf.handle}</div>}
                {inf.niche && <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 4 }}>{inf.niche}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
