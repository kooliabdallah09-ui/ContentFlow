'use client'

// Influencer Studio — create persistent AI characters, shoot photos of
// them anywhere, and send them into the UGC pipeline. Admin-gated.

import { useEffect, useState } from 'react'
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

  // Detail
  const [selected, setSelected] = useState<Influencer | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [scene, setScene] = useState('')
  const [shotCount, setShotCount] = useState(2)
  const [shooting, setShooting] = useState(false)
  const [bridging, setBridging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sheetLoading, setSheetLoading] = useState(false)

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
    if (description.trim().length < 10) {
      showError('Too short', 'Describe your influencer in at least a sentence')
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
          referenceImages: refImages.map(r => ({ base64: r.base64, mimeType: r.mimeType })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Creation failed')
      setList(prev => [data.influencer, ...prev])
      setDescription('')
      setRefImages([])
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
        body: JSON.stringify({ scene: scene.trim(), count: shotCount }),
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
    return (
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '48px 32px' }}>
        <button onClick={() => setSelected(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--ink-dim)', fontSize: 13.5, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={14} /> All influencers
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, alignItems: 'start' }}>
          {/* Identity card */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.portrait_url} alt={selected.name} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22 }}>{selected.name}</div>
              {selected.handle && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>{selected.handle}</div>}
              {selected.niche && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{selected.niche}</div>}
              {selected.bio && <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.55, margin: '10px 0 0' }}>{selected.bio}</p>}
              {selected.personality && <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5, margin: '8px 0 0', fontStyle: 'italic' }}>{selected.personality}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <button onClick={useInUgc} disabled={bridging} className="btn btn-primary" style={{ padding: '10px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {bridging ? <Loader2 size={14} className="animate-spin" /> : <Clapperboard size={14} />} Use in UGC
                </button>
                <button onClick={remove} disabled={deleting} style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-mute)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>

          {/* Photoshoot + gallery */}
          <div>
            {/* Character sheet — the multi-angle identity anchor */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, margin: 0 }}>Character sheet</h2>
                <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>multi-angle reference — makes every photo of them more accurate</span>
              </div>
              {selected.character_sheet_url ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <a href={selected.character_sheet_url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.character_sheet_url} alt="Character sheet" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                  </a>
                  <button onClick={generateSheet} disabled={sheetLoading} style={{ alignSelf: 'flex-start', padding: '7px 14px', fontSize: 12, borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-dim)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {sheetLoading ? <Loader2 size={13} className="animate-spin" /> : null} Regenerate sheet · 10 cr
                  </button>
                </div>
              ) : (
                <div style={{ padding: 16, borderRadius: 12, border: '1px dashed var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: 0, flex: 1, lineHeight: 1.5 }}>
                    No character sheet yet. Generate a full-body + head turnaround (front, profile, back) — photoshoots and UGC frames anchor to it for much better identity accuracy.
                  </p>
                  <button onClick={generateSheet} disabled={sheetLoading} className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {sheetLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate · 10 cr
                  </button>
                </div>
              )}
            </div>

            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, margin: '0 0 14px' }}>Photoshoot</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {SCENE_PRESETS.map(p => (
                <button key={p} onClick={() => setScene(p)} style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${scene === p ? 'var(--ink)' : 'var(--border)'}`,
                  background: scene === p ? 'var(--surface-2)' : 'var(--surface)',
                  color: 'var(--ink-2)',
                }}>{p}</button>
              ))}
            </div>
            <textarea
              className="textarea"
              rows={2}
              value={scene}
              onChange={e => setScene(e.target.value)}
              placeholder="…or describe any scene: 'walking through Tokyo in the rain with a clear umbrella'"
              style={{ fontSize: 13.5, marginBottom: 10 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setShotCount(n)} style={{
                    width: 34, height: 34, borderRadius: 9, fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${shotCount === n ? 'var(--ink)' : 'var(--border)'}`,
                    background: shotCount === n ? 'var(--ink)' : 'var(--surface)',
                    color: shotCount === n ? 'var(--on-ink)' : 'var(--ink-2)',
                    fontWeight: 600,
                  }}>{n}</button>
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{shotCount * 8} cr</span>
              <button onClick={photoshoot} disabled={shooting} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
                {shooting ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Shoot
              </button>
            </div>

            {photos.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {photos.map(p => (
                  <a key={p.id} href={p.image_url} target="_blank" rel="noreferrer" title={p.scene} style={{ display: 'block', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image_url} alt={p.scene} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
                  </a>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink-mute)' }}>No photos yet — pick a scene and hit Shoot.</p>
            )}
          </div>
        </div>
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

      {/* Create box */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 20, marginBottom: 32 }}>
        <textarea
          className="textarea"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. A laid-back surfer with sun-bleached curly hair and freckles who posts about sustainable skincare. Warm, a little sarcastic, always golden-hour lighting."
          style={{ fontSize: 14, marginBottom: 12 }}
        />

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
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>12 cr — identity sheet + portrait</span>
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
