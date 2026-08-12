'use client'

// Influencer Studio — create persistent AI characters, shoot photos of
// them anywhere, and send them into the UGC pipeline. Admin-gated.

import { useEffect, useState, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { DriveConnectBanner } from '@/components/DriveConnectBanner'
import { SectionTabs, STUDIOS_TABS } from '@/components/SectionTabs'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { canAccessInfluencerStudio } from '@/lib/pov-access'
import { showError, showSuccess } from '@/lib/notifications'
import { Loader2, Trash2, Camera, Clapperboard, Sparkles, ArrowLeft, ImagePlus, X } from 'lucide-react'
import { compressImageFile, type CompressedImage } from '@/lib/image-compress'
import { useImageDrop } from '@/hooks/useImageDrop'
import { ShootProgress, estimateShootSeconds } from '@/components/ShootProgress'

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
  // 2-candidate portrait picker: after the initial create, we hold the
  // Sonnet identity draft + the two rendered candidates here, and only
  // finalise once the user clicks one.
  const [candidates, setCandidates] = useState<Array<{ url: string; vibe: string }>>([])
  const [candidateIdentity, setCandidateIdentity] = useState<{ name?: string; handle?: string | null; bio?: string | null; personality?: string | null; niche?: string | null; appearance_prompt?: string } | null>(null)
  const [candidateReferenceUrls, setCandidateReferenceUrls] = useState<string[]>([])
  const [candidateModel, setCandidateModel] = useState<'pro' | 'nb2'>('pro')
  const [pickingCandidate, setPickingCandidate] = useState(false)
  // Regenerate flow: when the candidates modal was triggered by clicking
  // "Regenerate look" on an existing influencer, we carry the id so the
  // finalize call updates that row instead of inserting a new one.
  const [candidateUpdateId, setCandidateUpdateId] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  // Small popovers over the Regenerate look / Regenerate sheet buttons so
  // the user picks NB Pro vs NB2 (and 2K vs 4K for the sheet) without a
  // native prompt() interstitial.
  // Popover state carries the trigger button's viewport rect so a fixed-
  // position portal can anchor to it — needed because the identity card
  // uses overflow:hidden to clip the portrait, which was also clipping any
  // absolutely-positioned popovers rendered inside it.
  const [regenMenuAnchor, setRegenMenuAnchor] = useState<DOMRect | null>(null)
  const [regenNote, setRegenNote] = useState('')
  const [sheetMenuAnchor, setSheetMenuAnchor] = useState<DOMRect | null>(null)
  const regenBtnRef = useRef<HTMLButtonElement | null>(null)
  const sheetBtnRef = useRef<HTMLButtonElement | null>(null)
  // Close on scroll / resize / outside click so a stale anchor doesn't
  // leave the popover floating in a wrong spot.
  useEffect(() => {
    if (!regenMenuAnchor && !sheetMenuAnchor) return
    const close = () => { setRegenMenuAnchor(null); setSheetMenuAnchor(null) }
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (regenBtnRef.current?.contains(t) || sheetBtnRef.current?.contains(t)) return
      const menu = document.getElementById('influencer-detail-popover')
      if (menu?.contains(t)) return
      close()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('mousedown', outside)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('mousedown', outside)
    }
  }, [regenMenuAnchor, sheetMenuAnchor])
  const [showCreate, setShowCreate] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
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
  // Drag & drop for the two upload zones on this page.
  const refImagesDrop = useImageDrop({
    onFiles: async files => {
      for (const f of files.slice(0, 3 - refImages.length)) {
        try {
          const compressed = await compressImageFile(f, 1200, 0.85)
          setRefImages(prev => prev.length < 3 ? [...prev, compressed] : prev)
        } catch { showError('Image failed', `Could not read ${f.name}`) }
      }
    },
    disabled: refImages.length >= 3,
  })
  const sceneImagesDrop = useImageDrop({
    onFiles: async files => {
      for (const f of files.slice(0, 2 - sceneImages.length)) {
        try {
          const compressed = await compressImageFile(f, 1200, 0.85)
          setSceneImages(prev => prev.length < 2 ? [...prev, compressed] : prev)
        } catch { showError('Image failed', `Could not read ${f.name}`) }
      }
    },
    disabled: sceneImages.length >= 2,
  })
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false)
  const [shotCount, setShotCount] = useState(1)
  const [ratio, setRatio] = useState<'9:16' | '4:5' | '1:1' | '16:9'>('4:5')
  const [shootModel, setShootModel] = useState<'pro' | 'nb2' | '4k'>('pro')
  const [shooting, setShooting] = useState(false)
  const [bridging, setBridging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [studioProducts, setStudioProducts] = useState<Array<{ id: string; name: string; photo_urls: string[] }>>([])
  const [shootProductId, setShootProductId] = useState<string | undefined>(undefined)
  // Reusable Scenes — replaces the string presets with real environment
  // anchors. Picking a Scene passes its hero image to NB as a location ref.
  const [scenes, setScenes] = useState<Array<{ id: string; name: string; hero_image_url: string | null; scene_prompt: string }>>([])
  const [shootSceneId, setShootSceneId] = useState<string | undefined>(undefined)
  // Additional influencers to co-star with the currently-selected one in the same shot.
  const [guestInfluencerIds, setGuestInfluencerIds] = useState<string[]>([])
  // In-app lightbox for viewing photos (no more raw-URL tabs).
  const [lightbox, setLightbox] = useState<{ url: string; label?: string; photoId?: string } | null>(null)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [lightboxZoom, setLightboxZoom] = useState(false)

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
      try {
        const token = await getToken()
        if (token) {
          const res = await fetch('/api/products-studio', { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data?.products)) setStudioProducts(data.products)
          }
          // Scenes are optional too — 401s / 404s degrade to preset chips.
          const sceneRes = await fetch('/api/scenes', { headers: { Authorization: `Bearer ${token}` } })
          if (sceneRes.ok) {
            const sceneData = await sceneRes.json()
            if (Array.isArray(sceneData?.scenes)) setScenes(sceneData.scenes)
          }
        }
      } catch { /* optional */ }
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
    const hasTraits = createMode === 'traits' && !!(traitGender || traitAge || traitStyles.length || traitHair || traitEyes || traitHairstyle || traitFeatures.length)
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
          hairstyle: createMode === 'traits' ? (traitHairstyle || undefined) : undefined,
          faceFeatures: createMode === 'traits' ? traitFeatures : [],
          model: createModel,
          referenceImages: refImages.map(r => ({ base64: r.base64, mimeType: r.mimeType })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Creation failed')
      // Two-step flow: server rendered 2 candidate portraits and returned them.
      // User picks one, then
      // we call /finalize to render the sheet + save the row.
      if (Array.isArray(data.candidates) && data.identity) {
        if (data.candidates.length === 1) {
          // Single candidate — auto-finalize directly without showing a picker.
          const chosenUrl = data.candidates[0].url
          const fRes = await fetch('/api/influencers/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              identity: data.identity,
              chosenUrl,
              unusedUrls: [],
              referenceUrls: Array.isArray(data.referenceUrls) ? data.referenceUrls : [],
              model: data.model === 'nb2' ? 'nb2' : 'pro',
            }),
          })
          const fData = await fRes.json()
          if (!fRes.ok) throw new Error(fData.error || 'Finalize failed')
          setList(prev => [fData.influencer, ...prev])
          setDescription(''); setRefImages([])
          setTraitName(''); setTraitGender(''); setTraitAge(''); setTraitStyles([]); setTraitHair(''); setTraitEyes(''); setTraitHairstyle(''); setTraitFeatures([])
          setShowCreate(false)
          showSuccess('Influencer created', `${fData.influencer.name} is ready.`)
          openDetail(fData.influencer)
        } else {
          setCandidates(data.candidates)
          setCandidateIdentity(data.identity)
          setCandidateReferenceUrls(Array.isArray(data.referenceUrls) ? data.referenceUrls : [])
          setCandidateModel(data.model === 'nb2' ? 'nb2' : 'pro')
          showSuccess('Pick your favorite', 'Two looks generated — click the one that feels right.')
        }
      }
    } catch (err) {
      showError('Creation failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setCreating(false)
    }
  }

  async function chooseCandidate(chosenUrl: string) {
    if (!candidateIdentity) return
    setPickingCandidate(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const unusedUrls = candidates.filter(c => c.url !== chosenUrl).map(c => c.url)
      const res = await fetch('/api/influencers/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          identity: candidateIdentity,
          chosenUrl,
          unusedUrls,
          referenceUrls: candidateReferenceUrls,
          model: candidateModel,
          updateInfluencerId: candidateUpdateId ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Finalize failed')
      if (candidateUpdateId) {
        // Regen: replace in place in the roster + refresh the detail view.
        setList(prev => prev.map(i => i.id === data.influencer.id ? data.influencer : i))
        if (selected?.id === data.influencer.id) setSelected(data.influencer)
        showSuccess('Look regenerated', `${data.influencer.name} has a fresh portrait.`)
      } else {
        setList(prev => [data.influencer, ...prev])
        // Wipe create form on new-create only — regen preserves the composer.
        setDescription(''); setRefImages([])
        setTraitName(''); setTraitGender(''); setTraitAge(''); setTraitStyles([]); setTraitHair(''); setTraitEyes(''); setTraitHairstyle(''); setTraitFeatures([])
        setShowCreate(false)
        showSuccess('Influencer created', `${data.influencer.name} is ready.`)
        openDetail(data.influencer)
      }
      setCandidates([]); setCandidateIdentity(null); setCandidateReferenceUrls([]); setCandidateUpdateId(null)
    } catch (err) {
      showError('Finalize failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setPickingCandidate(false)
    }
  }

  function cancelCandidates() {
    // User bailed on the picker — client-side wipe. The rendered candidate
    // uploads stay in storage; harmless small blobs.
    setCandidates([]); setCandidateIdentity(null); setCandidateReferenceUrls([]); setCandidateUpdateId(null)
  }

  async function regenerateLook(model: 'pro' | 'nb2' = 'pro') {
    if (!selected) return
    const note = regenNote.trim()
    setRegenerating(true)
    setRegenMenuAnchor(null)
    setRegenNote('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/influencers/${selected.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model, note: note || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Regenerate failed')
      if (!Array.isArray(data.candidates) || !data.identity) throw new Error('Malformed regenerate response')
      if (data.candidates.length === 1) {
        // Single candidate — auto-finalize directly.
        const updateId = typeof data.updateInfluencerId === 'string' ? data.updateInfluencerId : selected.id
        const fRes = await fetch('/api/influencers/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            identity: data.identity,
            chosenUrl: data.candidates[0].url,
            unusedUrls: [],
            referenceUrls: Array.isArray(data.referenceUrls) ? data.referenceUrls : [],
            model: data.model === 'nb2' ? 'nb2' : 'pro',
            updateInfluencerId: updateId,
          }),
        })
        const fData = await fRes.json()
        if (!fRes.ok) throw new Error(fData.error || 'Finalize failed')
        setList(prev => prev.map(i => i.id === fData.influencer.id ? fData.influencer : i))
        if (selected?.id === fData.influencer.id) setSelected(fData.influencer)
        showSuccess('Look regenerated', `${fData.influencer.name} has a fresh portrait.`)
      } else {
        setCandidates(data.candidates)
        setCandidateIdentity(data.identity)
        setCandidateReferenceUrls(Array.isArray(data.referenceUrls) ? data.referenceUrls : [])
        setCandidateModel(data.model === 'nb2' ? 'nb2' : 'pro')
        setCandidateUpdateId(typeof data.updateInfluencerId === 'string' ? data.updateInfluencerId : selected.id)
        showSuccess('Pick your favorite', 'Two fresh looks — click the one that fits.')
      }
    } catch (err) {
      showError('Regenerate failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setRegenerating(false)
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

  async function generateSheet(resolution: '2K' | '4K' = '2K') {
    if (!selected) return
    setSheetLoading(true)
    setSheetMenuAnchor(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/influencers/${selected.id}/character-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resolution }),
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
          quality: shootModel,
          studioProductId: shootProductId,
          sceneId: shootSceneId,
          guestInfluencerIds,
          sceneImages: sceneImages.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
        }),
      })
      const text = await res.text()
      let data: { photos: typeof photos; creditsCharged: number; failed: number; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 120) || 'Photoshoot failed') }
      if (!res.ok) throw new Error(data.error || 'Photoshoot failed')
      setPhotos(prev => [...data.photos, ...prev])
      if (data.failed > 0) {
        showError('Partial shoot', `${data.photos.length} of ${data.photos.length + data.failed} photos came back — only charged ${data.creditsCharged} cr for what rendered. Re-run to fill the gap.`)
      } else {
        showSuccess('Photoshoot done', `${data.photos.length} photo${data.photos.length > 1 ? 's' : ''} · ${data.creditsCharged} cr`)
      }
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

  async function removePhoto(photoId: string) {
    if (!selected) return
    if (!confirm('Remove this photo? This cannot be undone.')) return
    setRemovingPhoto(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch(`/api/influencers/${selected.id}/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      setLightbox(null)
      showSuccess('Photo removed', 'One down.')
    } catch (err) {
      showError('Delete failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setRemovingPhoto(false)
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
      <SectionTabs tabs={STUDIOS_TABS} />
      {/* Portalled popovers for Regenerate look / Regenerate sheet — escape
          the identity card's overflow:hidden clipping. */}
      {typeof document !== 'undefined' && regenMenuAnchor && createPortal(
        <div
          id="influencer-detail-popover"
          style={{ position: 'fixed', top: regenMenuAnchor.bottom + 4, left: regenMenuAnchor.left, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: '0 12px 40px rgba(0,0,0,0.22)', overflow: 'hidden', minWidth: 260 }}
        >
          <div style={{ padding: '10px 12px 8px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6 }}>Optional tweak before regenerating</div>
            <textarea
              autoFocus
              value={regenNote}
              onChange={e => setRegenNote(e.target.value)}
              placeholder="e.g. make her hair darker, add glasses…"
              rows={2}
              style={{ width: '100%', resize: 'none', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2, #1a1a1a)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button
            onClick={() => regenerateLook('pro')}
            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12.5, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{ fontWeight: 600 }}>Nano Banana Pro · 32 cr</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Best fidelity for face + identity</span>
          </button>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button
            onClick={() => regenerateLook('nb2')}
            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12.5, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{ fontWeight: 600 }}>Nano Banana 2 · 20 cr</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Cheaper, slightly less accurate</span>
          </button>
        </div>,
        document.body,
      )}
      {typeof document !== 'undefined' && sheetMenuAnchor && createPortal(
        <div
          id="influencer-detail-popover"
          style={{ position: 'fixed', top: sheetMenuAnchor.bottom + 4, left: sheetMenuAnchor.left, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: '0 12px 40px rgba(0,0,0,0.22)', overflow: 'hidden', minWidth: 240 }}
        >
          <button
            onClick={() => generateSheet('2K')}
            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12.5, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{ fontWeight: 600 }}>2K · 8 cr</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Default — fine for downstream shoots</span>
          </button>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button
            onClick={() => generateSheet('4K')}
            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12.5, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{ fontWeight: 600 }}>4K · 14 cr</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Sharper face close-ups, best identity anchor</span>
          </button>
        </div>,
        document.body,
      )}
      <DriveConnectBanner />
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
              {/* Regenerate look — portalled popover to pick NB Pro (32 cr)
                  or NB 2 (20 cr). Uses a fixed-position portal so the
                  identity card's overflow:hidden doesn't clip the menu. */}
              <button
                ref={regenBtnRef}
                onClick={() => {
                  const r = regenBtnRef.current?.getBoundingClientRect() ?? null
                  setSheetMenuAnchor(null)
                  setRegenMenuAnchor(prev => prev ? null : r)
                }}
                disabled={regenerating}
                title="Rewrite the appearance with the current visual guidelines and pick a fresh portrait"
                style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {regenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Regenerate look <span style={{ opacity: 0.6, fontSize: 10 }}>▾</span>
              </button>
              {selected.character_sheet_url ? (
                <>
                  <button onClick={() => { setLightbox({ url: selected.character_sheet_url!, label: 'Character sheet' }); setLightboxZoom(false) }} style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer' }}>
                    View character sheet
                  </button>
                  <button
                    onClick={() => generateSheet('4K')}
                    disabled={sheetLoading}
                    style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-mute)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {sheetLoading ? <Loader2 size={13} className="animate-spin" /> : null} Regenerate sheet <span style={{ opacity: 0.6, fontSize: 10 }}>4K · 14 cr</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => generateSheet('4K')}
                  disabled={sheetLoading}
                  style={{ padding: '9px 14px', fontSize: 12.5, borderRadius: 9, background: 'transparent', border: '1px dashed var(--border)', color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {sheetLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate character sheet <span style={{ opacity: 0.6, fontSize: 10 }}>4K · 14 cr</span>
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
            /* Masonry via CSS columns — mixed aspect ratios (4:5 next to
               9:16) each keep their natural height and fill the column
               width, no letterboxing. */
            <div style={{ columns: '3 280px', columnGap: 14 }}>
              {photos.map(p => (
                <button key={p.id} onClick={() => { setLightbox({ url: p.image_url, label: p.scene, photoId: p.id }); setLightboxZoom(false) }} title={p.scene} style={{ display: 'block', width: '100%', marginBottom: 14, breakInside: 'avoid', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', padding: 0, cursor: 'zoom-in', background: 'var(--surface)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt={p.scene} style={{ width: '100%', display: 'block' }} />
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
        <div className="studio-composer" data-options-open={mobileOptionsOpen ? 'true' : 'false'} style={{ position: 'sticky', bottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <div className="studio-options">
          {studioProducts.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>With product</span>
              <button
                onClick={() => setShootProductId(undefined)}
                style={{ ...chip(!shootProductId), padding: '6px 12px' }}
              >
                None
              </button>
              {studioProducts.map(sp => {
                const active = shootProductId === sp.id
                return (
                  <button
                    key={sp.id}
                    onClick={() => setShootProductId(active ? undefined : sp.id)}
                    title={sp.name}
                    style={{ width: 40, height: 40, borderRadius: 9, overflow: 'hidden', padding: 0, cursor: 'pointer', border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: 'var(--surface)', flexShrink: 0 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sp.photo_urls?.[0]} alt={sp.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                )
              })}
            </div>
          )}
          {/* Guest influencers — feature other saved influencers in the same shot. */}
          {selected && list.filter(i => i.id !== selected.id).length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>+ Guest</span>
              {list.filter(i => i.id !== selected.id).map(g => {
                const active = guestInfluencerIds.includes(g.id)
                return (
                  <button
                    key={g.id}
                    onClick={() => setGuestInfluencerIds(prev => prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id])}
                    title={`${g.name}${active ? ' (selected — click to remove)' : ' — click to co-star them in the shot'}`}
                    style={{ width: 40, height: 52, borderRadius: 9, overflow: 'hidden', padding: 0, cursor: 'pointer', border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: 'var(--surface)', flexShrink: 0, position: 'relative' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.portrait_url} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {active && (
                      <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {guestInfluencerIds.indexOf(g.id) + 1}
                      </span>
                    )}
                  </button>
                )
              })}
              {guestInfluencerIds.length > 0 && (
                <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginLeft: 4 }}>+{guestInfluencerIds.length} co-star{guestInfluencerIds.length > 1 ? 's' : ''}</span>
              )}
            </div>
          )}
          {/* Reusable Scene picker — user-created environments trump one-off
              preset strings because they carry a real image anchor. */}
          {scenes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scene</span>
              <button
                onClick={() => setShootSceneId(undefined)}
                style={{ ...chip(!shootSceneId), padding: '6px 12px' }}
              >
                Custom
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {SCENE_PRESETS.map(p => (
              <button key={p} onClick={() => { setScene(p); setShootSceneId(undefined) }} style={{
                padding: '5px 11px', borderRadius: 999, fontSize: 11.5, cursor: 'pointer',
                border: `1px solid ${scene === p ? 'var(--ink)' : 'var(--border)'}`,
                background: scene === p ? 'var(--surface-2)' : 'var(--surface)',
                color: 'var(--ink-2)',
              }}>{p}</button>
            ))}
          </div>

          </div>
          <button
            type="button"
            className="studio-options-toggle"
            onClick={() => setMobileOptionsOpen(v => !v)}
            aria-expanded={mobileOptionsOpen}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-mute)' }}>
              <span>{mobileOptionsOpen ? 'Hide options' : 'Options'}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', opacity: 0.85 }}>
                {ratio} · {shotCount} shot{shotCount > 1 ? 's' : ''}
                {guestInfluencerIds.length > 0 && ` · +${guestInfluencerIds.length} 👤`}
                {shootProductId && ' · product'}
                {sceneImages.length > 0 && ` · ${sceneImages.length} ref`}
              </span>
            </span>
            <span style={{ fontSize: 14, transition: 'transform 180ms', transform: mobileOptionsOpen ? 'rotate(180deg)' : 'rotate(0)' }}>⌄</span>
          </button>
          <div className="ps-composer-row" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
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
                    title="Attach an outfit, product, or location photo to include in the shots — drag & drop works too"
                    {...sceneImagesDrop.dropzoneProps}
                    style={{ width: 44, height: 44, borderRadius: 9, border: `1.5px dashed ${sceneImagesDrop.isDragging ? 'var(--ink)' : 'var(--border)'}`, background: sceneImagesDrop.isDragging ? 'var(--hover)' : 'var(--surface-2, var(--surface))', color: sceneImagesDrop.isDragging ? 'var(--ink)' : 'var(--ink-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 120ms, border-color 120ms, color 120ms' }}>
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
            {shooting ? (
              <ShootProgress
                active
                estimatedSeconds={estimateShootSeconds({
                  count: shotCount,
                  quality: shootModel,
                  hasInfluencer: true,
                  coProductCount: shootProductId ? 1 : 0,
                })}
                label={`Shooting ${shotCount > 1 ? `${shotCount} photos` : ''}`}
              />
            ) : (
              <button onClick={photoshoot} className="btn btn-primary" style={{ padding: '13px 20px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <Camera size={15} /> Shoot
              </button>
            )}
          </div>

          {/* Format + count row */}
          <div className="ps-controls-row" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
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
              <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{shotCount * (shootModel === 'nb2' ? 4 : shootModel === '4k' ? 14 : 8)} cr</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setShootModel('nb2')} title="Cheaper — not as faithful to the face, can make small mistakes" style={chip(shootModel === 'nb2')}>NB2 · 4 cr · less accurate</button>
              <button onClick={() => setShootModel('pro')} title="Best identity fidelity" style={chip(shootModel === 'pro')}>Pro · 8 cr</button>
              <button onClick={() => setShootModel('4k')} title="Nano Banana Pro at 4K output — maximum detail" style={chip(shootModel === '4k')}>4K · 14 cr</button>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
          >
            {/* Click the image to zoom to full resolution (scroll to pan). */}
            <div
              onClick={e => e.stopPropagation()}
              style={lightboxZoom
                ? { maxWidth: '92vw', maxHeight: '82vh', overflow: 'auto', borderRadius: 12, cursor: 'zoom-out' }
                : { display: 'contents' }}
            >
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
                    a.download = (lightbox.label ?? 'photo').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60) + '.png'
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
              <button
                onClick={() => setLightbox(null)}
                style={{ padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)', fontSize: 12.5, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Candidate picker — same modal as the list view. Injected here
            because the detail view early-returns before hitting the shared
            modal below, and Regenerate Look is triggered from THIS view. */}
        {candidates.length > 0 && candidateIdentity && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 24, maxWidth: 980, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26 }}>{candidateIdentity.name}</span>
                {candidateIdentity.handle && <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>{candidateIdentity.handle}</span>}
                <button
                  onClick={cancelCandidates}
                  disabled={pickingCandidate}
                  style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-mute)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
                >Discard</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '0 0 18px' }}>
                Pick the look that feels most like your character. Only the chosen portrait will be saved; the others are discarded.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                {candidates.map(c => (
                  <button
                    key={c.url}
                    onClick={() => chooseCandidate(c.url)}
                    disabled={pickingCandidate}
                    title={`Pick this look (${c.vibe})`}
                    style={{ padding: 0, background: 'var(--surface-2, var(--surface))', border: '2px solid var(--border)', borderRadius: 14, cursor: pickingCandidate ? 'wait' : 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 120ms, border-color 120ms' }}
                    onMouseEnter={e => { if (!pickingCandidate) { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.url} alt={c.vibe} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
                    <span style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, textAlign: 'left' }}>
                      {c.vibe}
                    </span>
                  </button>
                ))}
              </div>
              {pickingCandidate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, color: 'var(--ink-mute)', fontSize: 13 }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Building the character sheet — this takes ~20-30 seconds…</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    )
  }

  // ── List + create view ───────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '48px 32px' }}>
      <SectionTabs tabs={STUDIOS_TABS} />
      <DriveConnectBanner />
      <div style={{ marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>ADMIN · BETA</div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 400, margin: '0 0 6px' }}>Influencer <em>studio</em></h1>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', margin: '0 0 28px', maxWidth: 560, lineHeight: 1.6 }}>
        Describe a character once — get a persistent AI influencer with a face, a handle, and a personality. Shoot photos of them anywhere, or drop them into a UGC ad.
      </p>

      {/* Collapsed by default so the roster is immediately visible. */}
      {!showCreate && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary"
            style={{ padding: '12px 22px', fontSize: 14, borderRadius: 11, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Sparkles size={15} /> Create new influencer
          </button>
          <button
            onClick={() => setShowInfo(v => !v)}
            title="How it works & persona ideas"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--border)',
              background: showInfo ? 'var(--ink)' : 'var(--surface)',
              color: showInfo ? 'var(--on-ink)' : 'var(--ink-dim)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, transition: 'all 0.15s', flexShrink: 0,
            }}
          >ⓘ</button>
        </div>
      )}

      {/* Candidate picker — after create returns 4 portraits with different
          vibes, user picks the one they like most. */}
      {candidates.length > 0 && candidateIdentity && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 24, maxWidth: 980, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26 }}>{candidateIdentity.name}</span>
              {candidateIdentity.handle && <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>{candidateIdentity.handle}</span>}
              <button
                onClick={cancelCandidates}
                disabled={pickingCandidate}
                style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-mute)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
              >Discard</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '0 0 18px' }}>
              Pick the look that feels most like your character. Only the chosen portrait will be saved; the others are discarded.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {candidates.map(c => (
                <button
                  key={c.url}
                  onClick={() => chooseCandidate(c.url)}
                  disabled={pickingCandidate}
                  title={`Pick this look (${c.vibe})`}
                  style={{ padding: 0, background: 'var(--surface-2, var(--surface))', border: '2px solid var(--border)', borderRadius: 14, cursor: pickingCandidate ? 'wait' : 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 120ms, border-color 120ms' }}
                  onMouseEnter={e => { if (!pickingCandidate) { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={c.vibe} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
                  <span style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, textAlign: 'left' }}>
                    {c.vibe}
                  </span>
                </button>
              ))}
            </div>
            {pickingCandidate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, color: 'var(--ink-mute)', fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" />
                <span>Building the character sheet — this takes ~20-30 seconds…</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create box — structured identity picker */}
      {showCreate && (
      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 22, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Create new influencer</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>Define your AI persona&apos;s identity and visual style — every pick is locked in exactly.</div>
          </div>
          <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4 }} title="Close">
            <X size={18} />
          </button>
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
              <span style={{ fontSize: 11, opacity: 0.8 }}>best identity fidelity · 18 cr</span>
            </button>
            <button onClick={() => setCreateModel('nb2')} style={{ ...chip(createModel === 'nb2'), flexDirection: 'column', alignItems: 'flex-start', borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ fontWeight: 700 }}>Nano Banana 2</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>cheaper · 11 cr · not as sharp, can make mistakes</span>
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
                {...refImagesDrop.dropzoneProps}
                style={{ width: 56, height: 56, borderRadius: 10, border: `1.5px dashed ${refImagesDrop.isDragging ? 'var(--ink)' : 'var(--border)'}`, background: refImagesDrop.isDragging ? 'var(--hover)' : 'var(--surface-2)', color: refImagesDrop.isDragging ? 'var(--ink)' : 'var(--ink-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms, border-color 120ms, color 120ms' }}
                title="Add reference photos (up to 3) — drag & drop works too. The influencer's face and look will be based on them."
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
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{createModel === 'nb2' ? '12' : '20'} cr — identity + portrait</span>
          <button onClick={create} disabled={creating} className="btn btn-primary" style={{ padding: '11px 22px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {creating ? 'Casting…' : 'Create influencer'}
          </button>
        </div>
      </div>
      )}

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
          <button onClick={() => setShowCreate(true)} style={{ border: '1.5px dashed var(--border)', borderRadius: 14, background: 'transparent', cursor: 'pointer', minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink-mute)' }}>
            <Sparkles size={22} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Create another influencer</span>
          </button>
        </div>
      )}

      {/* How it works + Persona ideas — hidden behind the ⓘ button */}
      {showInfo && (
        <div style={{ marginBottom: 36, padding: '24px 28px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>How it works</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
            {[
              ['1', 'Cast them once', 'Pick traits or describe them freely — the AI locks in a face, a handle, and a personality that never drifts.'],
              ['2', 'Shoot them anywhere', 'Beach, gym, Tokyo in the rain — every photo keeps their exact identity, anchored to their character sheet.'],
              ['3', 'Put them to work', 'Drop them into UGC ads, social carousels, or product shoots — the same face across your whole brand.'],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--on-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{n}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Need a persona idea?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {[
              ['🧖‍♀️', 'The skincare realist', 'A no-nonsense reviewer in her late 20s with visible texture and freckles who tests products for a month before talking. Dry humor, zero filter.'],
              ['🏋️', 'The everyday lifter', 'A friendly gym regular who films between sets — approachable physique, sweaty honesty, hates fitness-bro clichés.'],
              ['🍳', 'The 15-minute cook', 'A chaotic-but-charming home cook who makes fast weeknight meals in a small apartment kitchen and talks with their hands.'],
              ['💻', 'The desk-setup guy', 'A calm tech minimalist who reviews gear from a moody desk corner, speaks quietly and precisely, obsessed with cable management.'],
              ['✈️', 'The budget traveler', 'A backpacker in her early 20s filming from hostels and street markets — sun-faded clothes, infectious energy, always mid-adventure.'],
              ['🛋️', 'The cozy-home curator', 'A soft-spoken interiors lover restyling corners of their apartment — warm lamp light, plants, tactile close-ups.'],
            ].map(([emoji, title, desc]) => (
              <button
                key={title}
                onClick={() => {
                  setCreateMode('describe')
                  setDescription(String(desc))
                  setShowCreate(true)
                  setShowInfo(false)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 13, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <span style={{ fontSize: 20 }}>{emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
