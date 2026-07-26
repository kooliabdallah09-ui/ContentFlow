'use client'

// Product Studio — the Influencer Studio pattern, for products. Upload the
// product from multiple angles once; generate aesthetic AI photoshoots of
// it forever. Concepts are AI-directed and variety-tracked so repeat
// batches don't produce the same format twice.

import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'
import { compressImageFile, type CompressedImage } from '@/lib/image-compress'
import { Loader2, Trash2, Camera, Sparkles, ArrowLeft, ImagePlus, X } from 'lucide-react'
import { useImageDrop } from '@/hooks/useImageDrop'
import { ShootProgress, estimateShootSeconds } from '@/components/ShootProgress'

interface StudioProduct {
  id: string
  name: string
  category?: string | null
  description?: string | null
  photo_urls: string[]
  created_at: string
}

interface ProductPhoto {
  id: string
  concept: string
  image_url: string
  created_at: string
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

export default function ProductStudio() {
  const [list, setList] = useState<StudioProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Create
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createWhatItIs, setCreateWhatItIs] = useState('')
  const [createPhotos, setCreatePhotos] = useState<Array<CompressedImage & { angle?: string }>>([])
  const [creating, setCreating] = useState(false)
  const [aiFilling, setAiFilling] = useState(false)

  async function aiFill() {
    setAiFilling(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/products-studio/ai-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quick: createWhatItIs.trim() || undefined,
          photo: createPhotos[0] ? { base64: createPhotos[0].base64, mimeType: createPhotos[0].mimeType } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI fill failed')
      if (data.name) setCreateName(data.name)
      if (data.whatItIs) setCreateWhatItIs(data.whatItIs)
    } catch (err) {
      showError('AI fill failed', err instanceof Error ? err.message : 'Add a photo or a quick description first')
    } finally {
      setAiFilling(false)
    }
  }

  // Detail
  const [selected, setSelected] = useState<StudioProduct | null>(null)
  const [photos, setPhotos] = useState<ProductPhoto[]>([])
  const [direction, setDirection] = useState('')
  // aesthetic = editorial lifestyle photos; ad = bold typographic promo graphics
  const [mode, setMode] = useState<'aesthetic' | 'ad'>('aesthetic')
  const [shotCount, setShotCount] = useState(1)
  const [ratio, setRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('4:5')
  const [shootModel, setShootModel] = useState<'pro' | 'nb2'>('pro')
  const [shootRes, setShootRes] = useState<'2K' | '4K'>('2K')
  const quality: 'nb2' | 'pro' | '4k' = shootModel === 'nb2' ? 'nb2' : shootRes === '4K' ? '4k' : 'pro'
  const [shooting, setShooting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; label?: string; photoId?: string } | null>(null)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  // Feature one or more influencers in the shots (401s harmlessly for non-admin).
  const [influencers, setInfluencers] = useState<Array<{ id: string; name: string; portrait_url: string }>>([])
  const [shootInfluencerIds, setShootInfluencerIds] = useState<string[]>([])
  // Reusable Scenes from Scene Studio — pick one to lock the shoot to that
  // exact location (hero image + scene_prompt travel as anchors to NB Pro).
  const [scenes, setScenes] = useState<Array<{ id: string; name: string; hero_image_url: string | null; scene_prompt: string }>>([])
  const [shootSceneId, setShootSceneId] = useState<string | undefined>(undefined)
  // Feature one or more of the user's OTHER products alongside the current one
  // (e.g. flat-lay of two SKUs, or an influencer holding two products).
  const [shootCoProductIds, setShootCoProductIds] = useState<string[]>([])
  const [lightboxZoom, setLightboxZoom] = useState(false)
  // Phone UX: everything except textarea + Shoot is hidden behind a fold.
  // Auto-open on desktop-width so the composer is fully visible there.
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false)
  // Optional style-reference upload — user drops in an ad they want to
  // riff on and NB Pro rebuilds it with THEIR product. Base64 for the API.
  // Style refs: 1 image = "recreate this exact layout with my product swapped in"
  // (strict copy mode). 2-6 images = "channel the mood/lighting/palette only,
  // don't copy any specific composition or product" (mood mode).
  const [styleRefs, setStyleRefs] = useState<CompressedImage[]>([])
  const styleRef = styleRefs[0] ?? null   // legacy alias used by existing UI

  // Drag-and-drop targets. Style ref accepts one image, product-create accepts up to 5.
  const styleRefDrop = useImageDrop({
    onFiles: async files => {
      for (const f of files.slice(0, 6 - styleRefs.length)) {
        try {
          const compressed = await compressImageFile(f, 1600, 0.9)
          setStyleRefs(prev => prev.length >= 6 ? prev : [...prev, compressed])
        } catch { showError('Image failed', `Could not read ${f.name}`) }
      }
    },
  })
  function setStyleRef(img: CompressedImage | null) {
    setStyleRefs(img ? [img] : [])
  }
  const productPhotosDrop = useImageDrop({
    onFiles: async files => {
      for (const f of files.slice(0, 5 - createPhotos.length)) {
        try {
          const compressed = await compressImageFile(f, 1400, 0.85)
          setCreatePhotos(prev => prev.length < 5 ? [...prev, compressed] : prev)
        } catch { showError('Image failed', `Could not read ${f.name}`) }
      }
    },
    disabled: createPhotos.length >= 5,
  })

  const CR = { nb2: 5, pro: 10, '4k': 18 } as const

  // Prefill from Format Library redirects (see UGCPackageBuilder → photo
  // format handling). Reads ?formatKey=&mode=aesthetic&substyle=…&productName=&productDescription=
  // on mount and: (a) locks mode to aesthetic, (b) seeds the direction box
  // with a sub-style hint so the AI concept generator biases toward that
  // look, (c) prefills the Create form fields if the user hasn't picked a
  // product yet.
  const searchParams = useSearchParams()
  useEffect(() => {
    if (!searchParams) return
    const paramMode = searchParams.get('mode')
    const substyle = searchParams.get('substyle')
    const pName = searchParams.get('productName')
    const pDesc = searchParams.get('productDescription')
    if (paramMode === 'aesthetic') setMode('aesthetic')
    if (substyle) {
      const hint =
        substyle === 'editorial' ? 'Hero editorial energy — magazine-cover composition, dramatic single-point studio lighting, hero product front-and-center on a rich textured surface.' :
        substyle === 'lifestyle' ? 'Lifestyle in-scene — product used in a real environment, candid moment, natural light, human hands or ambient life in frame.' :
        substyle === 'studio' ? 'Studio still — clean minimal seamless backdrop, controlled lighting, sculptural product-first composition with strong negative space.' :
        ''
      if (hint) setDirection(prev => prev.trim() ? prev : hint)
    }
    if (pName || pDesc) {
      if (pName) setCreateName(prev => prev || pName)
      if (pDesc) setCreateWhatItIs(prev => prev || pDesc)
      // Only auto-open the Create form if there's nothing selected yet.
      setShowCreate(prev => prev || (!selected))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    load()
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) return
        const res = await fetch('/api/influencers', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data?.influencers)) setInfluencers(data.influencers)
        }
      } catch { /* hidden for non-admin */ }
    })()
    // Reusable Scenes — 401 / empty degrades silently.
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) return
        const res = await fetch('/api/scenes', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data?.scenes)) setScenes(data.scenes)
        }
      } catch { /* silent */ }
    })()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/products-studio', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setList(data.products ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    if (!createPhotos.length) {
      showError('No photos', 'Upload at least one photo of the product — more angles = better fidelity')
      return
    }
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/products-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: createName.trim() || undefined,
          whatItIs: createWhatItIs.trim() || undefined,
          photos: createPhotos.map(p => ({ base64: p.base64, mimeType: p.mimeType, angle: p.angle })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Creation failed')
      setList(prev => [data.product, ...prev])
      setCreateName('')
      setCreateWhatItIs('')
      setCreatePhotos([])
      setShowCreate(false)
      showSuccess('Product added', `${data.product.name} is ready for photoshoots.`)
      openDetail(data.product)
    } catch (err) {
      showError('Creation failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setCreating(false)
    }
  }

  async function openDetail(p: StudioProduct) {
    setSelected(p)
    setPhotos([])
    setDirection('')
    const token = await getToken()
    if (!token) return
    const res = await fetch(`/api/products-studio/${p.id}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) {
      setPhotos(data.photos ?? [])
      if (data.product) setSelected(data.product)
    }
  }

  async function photoshoot() {
    if (!selected) return
    setShooting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/products-studio/${selected.id}/photoshoot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          direction: direction.trim() || undefined,
          count: shotCount,
          ratio,
          quality,
          // Legacy single-influencer field kept for the server's backward-compat
          // path, plus the new multi-select array.
          influencerId: shootInfluencerIds[0],
          influencerIds: shootInfluencerIds,
          coProductIds: shootCoProductIds,
          sceneId: shootSceneId,
          mode,
          // 1 ref → strict "recreate this layout" mode (legacy field).
          // 2-6 refs → mood-only inspo mode (new field).
          styleReference: styleRefs.length === 1 ? { base64: styleRefs[0].base64, mimeType: styleRefs[0].mimeType } : undefined,
          styleReferences: styleRefs.length >= 2 ? styleRefs.map(r => ({ base64: r.base64, mimeType: r.mimeType })) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Photoshoot failed')
      setPhotos(prev => [...data.photos, ...prev])
      const requested = typeof data.requested === 'number' ? data.requested : data.photos.length
      const rendered = data.photos.length
      if (rendered < requested) {
        showError('Partial shoot', `${rendered}/${requested} shots came back — only charged ${data.creditsCharged} cr for what rendered. Re-run for the rest.`)
      } else {
        showSuccess('Shoot done', `${rendered} photo${rendered > 1 ? 's' : ''} · ${data.creditsCharged} cr`)
      }
    } catch (err) {
      showError('Photoshoot failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setShooting(false)
    }
  }

  async function removePhoto(photoId: string) {
    if (!selected) return
    if (!confirm('Remove this photo? This cannot be undone.')) return
    setRemovingPhoto(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/products-studio/${selected.id}/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      setLightbox(null)
      showSuccess('Photo removed', 'One down, keep the ones you love.')
    } catch (err) {
      showError('Delete failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setRemovingPhoto(false)
    }
  }

  async function remove() {
    if (!selected) return
    if (!confirm(`Delete ${selected.name} and all its photos?`)) return
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/products-studio/${selected.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setList(prev => prev.filter(p => p.id !== selected.id))
      setSelected(null)
    } catch (err) {
      showError('Delete failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setDeleting(false)
    }
  }

  // ── Detail view ──────────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '60vh' }}>
        <button onClick={() => setSelected(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--ink-dim)', fontSize: 13.5, cursor: 'pointer', marginBottom: 18, padding: 0, alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> All products
        </button>

        {/* Product banner */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', marginBottom: 18 }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {selected.photo_urls.slice(0, 2).map((u, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={u} alt={selected.name} style={{ width: 130, height: 170, objectFit: 'cover', display: 'block', borderRight: '1px solid var(--border)' }} />
            ))}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 23 }}>{selected.name}</span>
              {selected.category && <span style={{ fontSize: 11, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{selected.category}</span>}
            </div>
            {selected.description && <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, margin: 0 }}>{selected.description}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{selected.photo_urls.length} reference angle{selected.photo_urls.length > 1 ? 's' : ''}</span>
              <button onClick={remove} disabled={deleting} style={{ marginLeft: 'auto', padding: '7px 13px', fontSize: 12, borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-mute)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div style={{ flex: 1, marginBottom: 18 }}>
          {photos.length > 0 ? (
            <div style={{ columns: '3 260px', columnGap: 12 }}>
              {photos.map(p => (
                <button key={p.id} onClick={() => { setLightbox({ url: p.image_url, label: p.concept, photoId: p.id }); setLightboxZoom(false) }} title={p.concept} style={{ display: 'block', width: '100%', marginBottom: 12, breakInside: 'avoid', borderRadius: 13, overflow: 'hidden', border: '1px solid var(--border)', padding: 0, cursor: 'zoom-in', background: 'var(--surface)', position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt={p.concept} style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10.5, fontWeight: 600, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '3px 8px', borderRadius: 999 }}>{p.concept}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: '54px 20px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13.5, border: '1px dashed var(--border)', borderRadius: 14 }}>
              No photos yet — hit Shoot below. Leave the direction empty and the AI invents fresh concepts every time.
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="studio-composer" data-options-open={mobileOptionsOpen ? 'true' : 'false'} style={{ position: 'sticky', bottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          {/* All secondary controls (features, mode, style ref, ratio, count,
              quality) collapse behind a fold on phones. On desktop they're
              always visible via CSS. */}
          <div className={`studio-options ${mobileOptionsOpen ? 'is-open' : ''}`}>
          {influencers.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feature</span>
              <button
                onClick={() => setShootInfluencerIds([])}
                style={{ ...chip(shootInfluencerIds.length === 0), padding: '6px 12px' }}
              >
                Product only
              </button>
              {influencers.map(inf => {
                const active = shootInfluencerIds.includes(inf.id)
                return (
                  <button
                    key={inf.id}
                    onClick={() => setShootInfluencerIds(prev => prev.includes(inf.id) ? prev.filter(id => id !== inf.id) : [...prev, inf.id])}
                    title={`${inf.name}${active ? ' (selected — click to remove)' : ' — click to add to the shot'}`}
                    style={{ width: 40, height: 52, borderRadius: 9, overflow: 'hidden', padding: 0, cursor: 'pointer', border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: 'var(--surface)', flexShrink: 0, position: 'relative' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inf.portrait_url} alt={inf.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {active && (
                      <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {shootInfluencerIds.indexOf(inf.id) + 1}
                      </span>
                    )}
                  </button>
                )
              })}
              {shootInfluencerIds.length > 1 && (
                <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginLeft: 4 }}>{shootInfluencerIds.length} people in shot</span>
              )}
            </div>
          )}
          {list.length > 1 && selected && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>+ Also feature</span>
              {list.filter(p => p.id !== selected.id).map(p => {
                const active = shootCoProductIds.includes(p.id)
                const thumb = p.photo_urls[0]
                return (
                  <button
                    key={p.id}
                    onClick={() => setShootCoProductIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                    title={`${p.name}${active ? ' (selected — click to remove)' : ' — click to add to the shot'}`}
                    style={{ width: 40, height: 40, borderRadius: 9, overflow: 'hidden', padding: 0, cursor: 'pointer', border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: 'var(--surface)', flexShrink: 0, position: 'relative' }}
                  >
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                    {active && (
                      <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {shootCoProductIds.indexOf(p.id) + 1}
                      </span>
                    )}
                  </button>
                )
              })}
              {shootCoProductIds.length > 0 && (
                <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginLeft: 4 }}>+{shootCoProductIds.length} product{shootCoProductIds.length > 1 ? 's' : ''} in shot</span>
              )}
            </div>
          )}
          {/* Reusable Scene picker — locks the shoot to a saved Scene Studio
              environment (its hero image + prompt travel as anchors to NB Pro). */}
          {scenes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scene</span>
              <button
                onClick={() => setShootSceneId(undefined)}
                style={{ ...chip(!shootSceneId), padding: '6px 12px' }}
              >
                AI picks
              </button>
              {scenes.map(s => {
                const active = shootSceneId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setShootSceneId(active ? undefined : s.id)}
                    title={s.name}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 0, borderRadius: 10, overflow: 'hidden', border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {s.hero_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.hero_image_url} alt={s.name} style={{ width: 46, height: 34, objectFit: 'cover', display: 'block' }} />
                    )}
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', padding: '0 10px 0 0' }}>{s.name}</span>
                  </button>
                )
              })}
            </div>
          )}
          {/* Mode toggle — Aesthetic photo vs typographic Ad graphic */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <button
              onClick={() => setMode('aesthetic')}
              style={{
                padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                background: mode === 'aesthetic' ? 'var(--ink)' : 'var(--surface)',
                color: mode === 'aesthetic' ? 'var(--on-ink)' : 'var(--ink)',
                border: `1px solid ${mode === 'aesthetic' ? 'var(--ink)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
            >📷 Aesthetic photo</button>
            <button
              onClick={() => setMode('ad')}
              style={{
                padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                background: mode === 'ad' ? 'var(--ink)' : 'var(--surface)',
                color: mode === 'ad' ? 'var(--on-ink)' : 'var(--ink)',
                border: `1px solid ${mode === 'ad' ? 'var(--ink)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
            >✨ Ad graphic</button>
          </div>
          </div>
          {/* Mobile toggle — shows only on phones. Summarises what's active so
              the user doesn't have to open the fold to check state. */}
          <button
            type="button"
            className="studio-options-toggle"
            onClick={() => setMobileOptionsOpen(v => !v)}
            aria-expanded={mobileOptionsOpen}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-mute)' }}>
              <span>{mobileOptionsOpen ? 'Hide options' : 'Options'}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', opacity: 0.85 }}>
                {mode === 'ad' ? '✨ Ad' : '📷 Photo'} · {ratio} · {shotCount} shot{shotCount > 1 ? 's' : ''} · {shotCount * CR[quality]} cr
                {shootInfluencerIds.length > 0 && ` · ${shootInfluencerIds.length} 👤`}
                {shootCoProductIds.length > 0 && ` · +${shootCoProductIds.length} 📦`}
                {styleRef && ' · style ref'}
              </span>
            </span>
            <span style={{ fontSize: 14, transition: 'transform 180ms', transform: mobileOptionsOpen ? 'rotate(180deg)' : 'rotate(0)' }}>⌄</span>
          </button>
          <div className="ps-composer-row" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            {/* Style references — 1 image = strict "recreate this layout"
                mode; 2-6 images = mood-only inspo (drop screenshots you
                saved from Pinterest, Insta, wherever). */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', maxWidth: 300 }}>
              {styleRefs.map((r, i) => (
                <div key={i} style={{ position: 'relative', width: 62, height: 62 }}>
                  <img
                    src={`data:${r.mimeType};base64,${r.base64}`}
                    alt={`Style ref ${i + 1}`}
                    onClick={() => setLightbox({ url: `data:${r.mimeType};base64,${r.base64}`, label: `Style ref ${i + 1}` })}
                    style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 10, border: '1.5px solid var(--ink)', cursor: 'zoom-in' }}
                  />
                  <button
                    onClick={() => setStyleRefs(prev => prev.filter((_, j) => j !== i))}
                    title="Remove"
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--ink)', color: 'var(--on-ink)', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {styleRefs.length < 6 && (
                <>
                  <input
                    id="styleRefInput"
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const files = Array.from(e.target.files ?? [])
                      e.currentTarget.value = ''
                      for (const f of files.slice(0, 6 - styleRefs.length)) {
                        try {
                          const compressed = await compressImageFile(f, 1600, 0.9)
                          setStyleRefs(prev => prev.length >= 6 ? prev : [...prev, compressed])
                        } catch { showError('Image failed', `Could not read ${f.name}`) }
                      }
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('styleRefInput')?.click()}
                    title={styleRefs.length === 0
                      ? "Drop 1 image to copy its exact layout, or 2-6 to feed mood/palette/lighting only."
                      : `Add another inspo image (${6 - styleRefs.length} slots left).`}
                    {...styleRefDrop.dropzoneProps}
                    style={{ width: 62, height: 62, borderRadius: 10, border: `1.5px dashed ${styleRefDrop.isDragging ? 'var(--ink)' : 'var(--border)'}`, background: styleRefDrop.isDragging ? 'var(--hover)' : 'var(--surface-2)', color: styleRefDrop.isDragging ? 'var(--ink)' : 'var(--ink-mute)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 0, fontSize: 10, lineHeight: 1.1, transition: 'background 120ms, border-color 120ms, color 120ms' }}
                  >
                    <ImagePlus size={16} />
                    <span>{styleRefs.length === 0 ? 'Inspo' : `+${6 - styleRefs.length}`}</span>
                  </button>
                </>
              )}
            </div>
            <textarea
              className="textarea"
              rows={2}
              value={direction}
              onChange={e => setDirection(e.target.value)}
              placeholder={styleRef
                ? "Optional tweak: 'keep the layout but make it more dramatic'… or leave empty and the AI matches the reference exactly."
                : "Optional direction: 'splashing into iced coffee', 'pastel pink set'… leave empty and the AI picks fresh concepts (never repeats a format)."}
              style={{ fontSize: 13.5, flex: 1, resize: 'none', margin: 0 }}
            />
            {shooting ? (
              <ShootProgress
                active
                estimatedSeconds={estimateShootSeconds({
                  count: shotCount,
                  quality,
                  hasStyleRef: !!styleRef,
                  hasInfluencer: shootInfluencerIds.length > 0,
                  coProductCount: shootCoProductIds.length,
                })}
                label={`Shooting ${shotCount > 1 ? `${shotCount} photos` : ''}`}
              />
            ) : (
              <button onClick={photoshoot} className="btn btn-primary" style={{ padding: '13px 20px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <Camera size={15} /> Shoot
              </button>
            )}
          </div>
          {styleRefs.length === 1 && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6 }}>
              1 reference attached — <strong>strict mode</strong>: the AI will match its composition, typography and palette while swapping in <em>{selected?.name}</em>. Drop another image to switch to <strong>mood-only</strong> mode.
            </div>
          )}
          {styleRefs.length >= 2 && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6 }}>
              {styleRefs.length} references attached — <strong>mood mode</strong>: the AI absorbs lighting, palette and composition energy from these but preserves <em>{selected?.name}</em>&apos;s packaging exactly. Won&apos;t copy competitor products or people.
            </div>
          )}
          <div className="ps-controls-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['1:1', '4:5', '9:16', '16:9'] as const).map(r => (
                <button key={r} onClick={() => setRatio(r)} style={chip(ratio === r)}>{r}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setShotCount(n)} style={{ ...chip(shotCount === n), width: 32, justifyContent: 'center', padding: '7px 0' }}>{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShootModel('nb2')} title="Cheaper — less accurate, can make mistakes" style={chip(shootModel === 'nb2')}>
                <span className="ps-quality-full">NB2 · 4 cr · less accurate</span>
                <span className="ps-quality-short">NB2 · 4</span>
              </button>
              <button onClick={() => setShootModel('pro')} title="Best fidelity" style={chip(shootModel === 'pro')}>NB Pro</button>
              {shootModel === 'pro' && (
                <>
                  <button onClick={() => setShootRes('2K')} style={chip(shootRes === '2K')}>2K · 8 cr</button>
                  <button onClick={() => setShootRes('4K')} style={chip(shootRes === '4K')}>4K · 14 cr</button>
                </>
              )}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginLeft: 'auto' }}>{shotCount * CR[quality]} cr</span>
          </div>
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
            <div onClick={e => e.stopPropagation()} style={lightboxZoom ? { maxWidth: '92vw', maxHeight: '82vh', overflow: 'auto', borderRadius: 12, cursor: 'zoom-out' } : { display: 'contents' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.url}
                alt={lightbox.label ?? 'photo'}
                onClick={e => { e.stopPropagation(); setLightboxZoom(z => !z) }}
                style={lightboxZoom
                  ? { display: 'block', maxWidth: 'none', maxHeight: 'none', width: 'auto', cursor: 'zoom-out' }
                  : { maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12, cursor: 'zoom-in' }}
              />
            </div>
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, cursor: 'default' }}>
              {lightbox.label && <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{lightbox.label}</span>}
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{lightboxZoom ? 'click image to zoom out' : 'click image to zoom'}</span>
              <button
                onClick={async () => {
                  try {
                    const blob = await fetch(lightbox.url).then(r => r.blob())
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = (lightbox.label ?? 'product-photo').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60) + '.png'
                    a.click()
                  } catch { window.open(lightbox.url, '_blank') }
                }}
                style={{ padding: '8px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Download
              </button>
              {lightbox.photoId && (
                <button
                  onClick={() => removePhoto(lightbox.photoId!)}
                  disabled={removingPhoto}
                  style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,120,120,0.55)', color: 'rgba(255,150,150,0.95)', fontSize: 12.5, fontWeight: 600, cursor: removingPhoto ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  title="Remove this photo permanently"
                >
                  <Trash2 size={13} /> {removingPhoto ? 'Removing…' : 'Remove'}
                </button>
              )}
              <button onClick={() => setLightbox(null)} style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)', fontSize: 12.5, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── List + create ────────────────────────────────────────────────────
  return (
    <div>
      {!showCreate && (
        <button onClick={() => setShowCreate(true)} className="btn btn-primary" style={{ padding: '12px 22px', fontSize: 14, borderRadius: 11, marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={15} /> Add a product
        </button>
      )}

      {showCreate && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 22, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Add a product</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>Upload it from several angles — front, back, side, contents. More angles = a more complete product sheet = more faithful photos.</div>
            </div>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              type="text"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Product name"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={aiFill}
              disabled={aiFilling}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px dashed var(--border)', background: 'var(--surface-2, var(--surface))', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {aiFilling ? <Loader2 size={13} className="animate-spin" /> : '✨'} {aiFilling ? 'Filling…' : 'Fill with AI (from a photo or quick note)'}
            </button>
          </div>
          <textarea
            className="textarea"
            rows={2}
            value={createWhatItIs}
            onChange={e => setCreateWhatItIs(e.target.value)}
            placeholder="What is the product? e.g. 'organic matcha powder in a green tin, for home lattes' — or type a rough note and hit Fill with AI"
            style={{ fontSize: 13.5, margin: 0 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {createPhotos.map((img, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 74, height: 74, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`angle ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setCreatePhotos(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, width: 17, height: 17, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0 }}>×</button>
                </div>
                <select
                  value={img.angle ?? ''}
                  onChange={e => setCreatePhotos(prev => prev.map((p, j) => j === i ? { ...p, angle: e.target.value || undefined } : p))}
                  style={{ width: 74, fontSize: 10.5, padding: '3px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-2)' }}
                >
                  <option value="">side?</option>
                  {['front', 'back', 'side', 'top', 'contents', 'detail'].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            ))}
            {createPhotos.length < 5 && (
              <>
                <input
                  id="productAngleInput"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const files = Array.from(e.target.files ?? []).slice(0, 5 - createPhotos.length)
                    e.target.value = ''
                    for (const f of files) {
                      try {
                        const compressed = await compressImageFile(f, 1400, 0.85)
                        setCreatePhotos(prev => prev.length < 5 ? [...prev, compressed] : prev)
                      } catch { showError('Image failed', `Could not read ${f.name}`) }
                    }
                  }}
                />
                <button
                  onClick={() => document.getElementById('productAngleInput')?.click()}
                  {...productPhotosDrop.dropzoneProps}
                  style={{ width: 74, height: 74, borderRadius: 10, border: `1.5px dashed ${productPhotosDrop.isDragging ? 'var(--ink)' : 'var(--border)'}`, background: productPhotosDrop.isDragging ? 'var(--hover)' : 'var(--surface-2, var(--surface))', color: productPhotosDrop.isDragging ? 'var(--ink)' : 'var(--ink-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms, border-color 120ms, color 120ms' }}
                  title="Add product photos — up to 5 angles. Drag & drop images here too."
                >
                  <ImagePlus size={20} />
                </button>
              </>
            )}
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', maxWidth: 260, lineHeight: 1.4 }}>Up to 5 photos. The AI builds the product sheet from them.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>3 cr — AI product sheet</span>
            <button onClick={create} disabled={creating} className="btn btn-primary" style={{ padding: '11px 22px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {creating ? 'Reading the product…' : 'Add product'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--ink-mute)' }} />
      ) : list.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--ink-mute)' }}>No products yet — add your first one above, then shoot it in any style.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {list.map(p => (
            <button key={p.id} onClick={() => openDetail(p)} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer', padding: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo_urls?.[0]} alt={p.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
                {p.category && <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 2 }}>{p.category}</div>}
              </div>
            </button>
          ))}
          {/* Ghost tile keeps the grid feeling alive with few products */}
          <button onClick={() => setShowCreate(true)} style={{ border: '1.5px dashed var(--border)', borderRadius: 14, background: 'transparent', cursor: 'pointer', minHeight: 230, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink-mute)' }}>
            <ImagePlus size={22} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Add another product</span>
          </button>
        </div>
      )}

      {/* How it works */}
      <div style={{ marginTop: 36 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>How it works</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            ['1', 'Upload every angle', 'Front, back, side, contents — the AI reads the packaging and builds a product sheet it can render faithfully.'],
            ['2', 'Hit Shoot', 'The AI art-directs each shot: stacked heroes, mid-air splashes, texture spreads… it never repeats a format.'],
            ['3', 'Direct it (optional)', 'Type a vibe — "pastel pink set", "splashing into iced coffee" — or feature one of your influencers using it.'],
          ].map(([n, title, desc]) => (
            <div key={n} style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--on-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{n}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shot inspiration — clicking one opens your product with the direction prefilled */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Shot inspiration</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            ['🗼', 'Stacked hero tower', 'products piled into a bold sculptural tower, hard light'],
            ['💦', 'Mid-air splash', 'product frozen mid-splash, droplets suspended'],
            ['🫳', 'Hands in frame', 'anonymous hands pouring, holding, unwrapping'],
            ['🪨', 'Texture spread', 'contents scattered across stone or travertine'],
            ['🌅', 'Hard-sun shadows', 'harsh directional sunlight, long graphic shadows'],
            ['🎨', 'Monochrome set', 'backdrop and props matched to the packaging colour'],
          ].map(([emoji, title, dir]) => (
            <button
              key={title}
              onClick={() => {
                if (!list.length) { setShowCreate(true); return }
                openDetail(list[0])
                setDirection(String(dir))
              }}
              style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 13, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-dim)', lineHeight: 1.45 }}>{dir}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
