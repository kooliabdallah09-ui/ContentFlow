'use client'

// UGC Builder v2 — chat-style interface. Ships behind ?v=2 on /generate/ugc.
//
// LAYOUT
//   [Top scroll area]  Conversation thread — user messages (their brief) +
//                      AI responses (rendering state, then completed video
//                      cards). Empty state prompts them to describe the ad.
//   [Bottom sticky]    Composer — chip toolbar (duration / resolution /
//                      aspect / engine) above a textarea + send button.
//                      Attach buttons for product + creator sit below.
//
// Feels like Claude / ChatGPT / Midjourney: history on top, controls on the
// bottom, results appear as messages. Settings are always visible as small
// chips right above the textarea, so users can tweak without opening a
// separate settings panel.

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Package, User2, Sparkles, X, Upload, ZoomIn, Images } from 'lucide-react'
import { getSupabase } from '@/lib/auth'
import { showError } from '@/lib/notifications'
import { ugcPackageCost } from '@/lib/ugc-pricing'

// ── Field shapes ────────────────────────────────────────────────────
export interface BuilderState {
  productName: string
  productDescription: string
  productImage?: { base64: string; mimeType: string; url?: string }
  // Optional supplementary photos — extra product angles, packaging shots,
  // mood-board images. Sent to hero-frames as extraProductImages, giving
  // Nano Banana Pro more visual context to lock the product's exact look.
  referenceImages: Array<{ base64: string; mimeType: string; previewUrl: string }>
  creatorName: string
  creatorId?: string             // "actor:xxx" or "inf:xxx" — the picker's row id
  // When creatorId is an influencer, we bridge them via /use-in-ugc which
  // produces a saved-actor row keyed to the influencer's locked character
  // prompt. This id is what hero-frames actually reads to reproduce the face.
  bridgedActorId?: string
  // The influencer's canonical portrait URL. Passing this as
  // influencerPhotoUrl to hero-frames forces it to skip the multi-angle
  // character-sheet ref (which confuses Nano Banana and produces face
  // drift) and use ONLY this clean single portrait as the identity anchor.
  creatorPhotoUrl?: string
  format: string
  formatKey?: string
  aspect: 'portrait' | 'square' | 'landscape' | 'tall45'
  duration: 5 | 10 | 15 | 20 | 30
  resolution: '480p' | '720p' | '1080p' | '4k'
  engine: 'seedance-2' | 'seedance-2-5' | 'seedance-mini'
  direction: string
  language: string
  musicMood?: string
  scrollStopHook: boolean
}

interface HeroFrame { url: string; caption?: string }

interface Message {
  id: string
  role: 'user' | 'assistant'
  kind: 'text' | 'rendering' | 'video' | 'error' | 'frames' | 'script'
  text?: string
  videoUrl?: string
  thumbUrl?: string
  // Script message: collapsed by default. Full text lives here, ChatBubble
  // shows a short "Script ready" chip with an expand toggle. onScriptChange,
  // when set, enables inline editing (Tweak) and hands the edited text back
  // so the same pipeline instance can re-run frames against it.
  script?: string
  onScriptChange?: (next: string) => void
  onScriptRerun?: (next: string) => void
  // Frame-picker message: the 4 hero-frame candidates + a callback the
  // ChatBubble invokes when the user taps one. Callback lives on the
  // message so re-renders don't lose the closure.
  frames?: HeroFrame[]
  onPickFrame?: (frameUrl: string) => void
  pickedFrameUrl?: string   // set once the user has picked, disables the picker
  timestamp: number
}

interface BrandProduct { id: string; name: string; image_url: string | null; product_type?: string }
interface SavedCreator {
  id: string
  name: string
  imageUrl: string
  // Origin dictates how downstream generation picks up the character:
  //   'actor'      → saved-actor row (previously-rendered UGC creator)
  //   'influencer' → Influencer Studio persona (has extra portrait/voice metadata)
  source: 'actor' | 'influencer'
}

const INITIAL: BuilderState = {
  productName: '',
  productDescription: '',
  creatorName: 'Auto',
  format: 'Auto',
  aspect: 'portrait',
  duration: 10,
  resolution: '1080p',
  engine: 'seedance-2',
  direction: '',
  language: 'English',
  scrollStopHook: false,
  referenceImages: [],
}

// ── Component ──────────────────────────────────────────────────────
interface UGCBuilderV2Props {
  onGenerate: (state: BuilderState) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

export function UGCBuilderV2({ onGenerate, isLoading, creditBalance }: UGCBuilderV2Props) {
  const [state, setState] = useState<BuilderState>(INITIAL)
  const [messages, setMessages] = useState<Message[]>([])
  const [composer, setComposer] = useState('')
  const [parsing, setParsing] = useState(false)
  const [openPanel, setOpenPanel] = useState<'settings' | 'product' | 'creator' | 'refs' | null>(null)
  const [products, setProducts] = useState<BrandProduct[]>([])
  const [creators, setCreators] = useState<SavedCreator[]>([])
  const [libLoaded, setLibLoaded] = useState(false)
  const [bridgingCreator, setBridgingCreator] = useState(false)
  // One-pipeline-at-a-time guard. Locks the Generate button (and script
  // rerun) from the moment a pipeline starts until it either lands a
  // finished video, errors, or the user picks a frame that also errors.
  // "Waiting for the user to pick a frame" counts as busy — otherwise a
  // second Generate would stack a competing pipeline in the thread.
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Lazy-load product + creator libraries the first time the user opens
  // either attach sheet. Cheap enough to fetch both together.
  useEffect(() => {
    if (openPanel !== 'product' && openPanel !== 'creator') return
    if (libLoaded) return
    let cancelled = false
    ;(async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) return
      const [pRes, aRes, iRes] = await Promise.all([
        fetch('/api/brand/products', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/ugc/saved-actors', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/influencers',     { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ])
      try {
        if (pRes?.ok) {
          const d = await pRes.json()
          if (!cancelled && Array.isArray(d?.products)) setProducts(d.products)
        }
      } catch { /* ignore */ }

      // Merge influencers + saved-actors into one creator list, de-duped by
      // name. Rationale: when you render UGC with a Studio influencer, the
      // pipeline also mirrors them into saved-actors for quick re-use, so
      // the same face shows up twice. Influencers are the richer record
      // (portrait + persona + character sheet), so we keep those and drop
      // the saved-actor shadow when the names collide.
      const merged: SavedCreator[] = []
      const seenNames = new Set<string>()
      const norm = (n: string) => n.trim().toLowerCase()

      // Influencers first — richer records win the name slot.
      try {
        if (iRes?.ok) {
          const d = await iRes.json()
          if (Array.isArray(d?.influencers)) {
            for (const inf of d.influencers) {
              if (inf?.id && inf?.name && inf?.portrait_url) {
                merged.push({ id: `inf:${inf.id}`, name: inf.name, imageUrl: inf.portrait_url, source: 'influencer' })
                seenNames.add(norm(inf.name))
              }
            }
          }
        }
      } catch { /* ignore */ }

      // Saved-actors second — skip any whose name already claimed by an influencer.
      try {
        if (aRes?.ok) {
          const d = await aRes.json()
          if (Array.isArray(d?.actors)) {
            for (const a of d.actors) {
              if (a?.id && a?.name && a?.hero_frame_url && !seenNames.has(norm(a.name))) {
                merged.push({ id: `actor:${a.id}`, name: a.name, imageUrl: a.hero_frame_url, source: 'actor' })
                seenNames.add(norm(a.name))
              }
            }
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setCreators(merged)
      if (!cancelled) setLibLoaded(true)
    })()
    return () => { cancelled = true }
  }, [openPanel, libLoaded])

  const cost = estimateCost(state)
  const canSend = composer.trim().length > 0 && !parsing && !isLoading

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  async function handleSend() {
    const brief = composer.trim()
    if (!canSend) return

    // Add user message to thread
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      kind: 'text',
      text: brief,
      timestamp: Date.now(),
    }
    setMessages(m => [...m, userMsg])
    setComposer('')
    setParsing(true)

    try {
      // Parse the brief into structured fields (Stage 2 will wire the real
      // /api/ugc/parse-brief endpoint; for Stage 1 we do a naive extraction).
      const supabase = getSupabase()
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/ugc/parse-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brief, current: state }),
      }).catch(() => null)

      let patch: Partial<BuilderState> = {}
      if (res?.ok) {
        patch = await res.json()
      } else {
        // Endpoint not built yet — assume the whole brief becomes direction.
        patch = { direction: brief }
      }
      setState(prev => ({ ...prev, ...patch }))

      // Add assistant confirmation message
      const summary = summariseChanges(patch, state)
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        kind: 'text',
        text: summary,
        timestamp: Date.now(),
      }
      setMessages(m => [...m, aiMsg])
    } catch (e) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        kind: 'error',
        text: e instanceof Error ? e.message : 'Something went wrong',
        timestamp: Date.now(),
      }
      setMessages(m => [...m, errMsg])
    } finally {
      setParsing(false)
    }
  }

  // Utility: replace a specific message by id.
  function patchMsg(id: string, patch: Partial<Message>) {
    setMessages(m => m.map(msg => msg.id === id ? { ...msg, ...patch } : msg))
  }

  function pushMsg(msg: Omit<Message, 'id' | 'timestamp'>): string {
    const id = crypto.randomUUID()
    setMessages(m => [...m, { ...msg, id, timestamp: Date.now() }])
    return id
  }

  // Full pipeline: script → hero-frames → (wait for user pick) → animate.
  // Each stage pushes a rendering message that gets swapped in place when
  // the stage completes, so the thread reads like a running conversation.
  async function handleGenerate() {
    if (busy) return  // one pipeline at a time — button should be disabled anyway
    if (!state.productName.trim()) {
      showError('Product needed', 'Tell me what product this ad is for first — describe it in the chat, or attach a product below.')
      return
    }
    setBusy(true)
    try {
      const supabase = getSupabase()
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      // Split creator id back into source + underlying id. For influencer
      // picks, hero-frames wants BOTH ids: the influencer id (for gallery
      // reference photos) and the bridged saved-actor id (which owns the
      // locked character prompt). Sending only one produces face drift.
      const [creatorSource, creatorRawId] = state.creatorId?.split(':') ?? []

      // If the pick was an influencer and the background bridge hasn't
      // finished yet (or the user hit Generate immediately), block here
      // and run the bridge inline. Without this we fall through with
      // savedActorId=undefined and the frames end up as a random face.
      let effectiveBridgedActorId = state.bridgedActorId
      if (creatorSource === 'influencer' && !effectiveBridgedActorId) {
        try {
          const br = await fetch(`/api/influencers/${creatorRawId}/use-in-ugc`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
          const brData = await br.json().catch(() => ({}))
          if (br.ok && brData?.actor?.id) {
            effectiveBridgedActorId = brData.actor.id
            setState(s => ({ ...s, bridgedActorId: brData.actor.id }))
          } else {
            throw new Error(brData?.error || `Couldn't attach creator (${br.status})`)
          }
        } catch (err) {
          throw new Error(err instanceof Error ? err.message : 'Failed to attach creator')
        }
      }

      const savedActorIdOut =
        creatorSource === 'actor'      ? creatorRawId
        : creatorSource === 'influencer' ? effectiveBridgedActorId
        : undefined
      const influencerIdOut = creatorSource === 'influencer' ? creatorRawId : undefined

      // If the user typed @image1 / @image2 tokens, prepend a short note
      // so Nano Banana can map the tokens to the attached reference
      // images by ordinal position. The nanobanana.ts prompt already
      // labels the extra refs as image1..imageN in the order they arrive.
      const mentionCount = (state.direction.match(/@image\d+/gi) ?? []).length
      const enrichedDirection = mentionCount > 0 && state.referenceImages.length > 0
        ? `${state.direction}\n\n(The @imageN tokens above refer to the ${state.referenceImages.length} reference image(s) attached — image1 is the first, image2 the second, etc.)`
        : state.direction

      // ── Step 1: draft script ─────────────────────────────────────
      const scriptMsgId = pushMsg({ role: 'assistant', kind: 'rendering', text: 'Writing your script…' })
      const scriptRes = await fetch('/api/ugc/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productName: state.productName,
          productDescription: state.productDescription || state.direction || state.productName,
          benefits: state.direction || state.productDescription,
          callToAction: 'Shop now',
          customInstructions: enrichedDirection || undefined,
          language: state.language,
        }),
      })
      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) throw new Error(scriptData.error || 'Script generation failed')
      const initialScript: string = cleanScript(scriptData.script)

      // Extract frames+animate into a callable so "Rerun with tweaked
      // script" can invoke it later with an edited script. Closes over
      // savedActorIdOut / influencerIdOut / token — the identity + auth
      // context stays consistent across re-runs.
      const runFramesAndAnimate = async (activeScript: string) => {
        const framesMsgId = pushMsg({ role: 'assistant', kind: 'rendering', text: 'Casting your creator and rendering 4 starting frames…' })
        return _runFramesAndAnimate(activeScript, framesMsgId)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _runFramesAndAnimate = async (activeScript: string, framesMsgId: string): Promise<void> => {
      const framesRes = await fetch('/api/ugc/hero-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productName: state.productName,
          productDescription: state.productDescription || state.direction || state.productName,
          productImageBase64: state.productImage?.base64 || undefined,
          productImageMimeType: state.productImage?.mimeType || undefined,
          avatarGender: 'Female',
          aspectId: state.aspect,
          videoDirection: enrichedDirection || undefined,
          script: activeScript,
          savedActorId: savedActorIdOut,
          influencerId: influencerIdOut,
          // NOTE: intentionally NOT passing influencerPhotoUrl. That would
          // short-circuit hero-frames to a single-portrait identity ref;
          // the endpoint's default loads the character sheet (turnaround)
          // FIRST, which is a stronger identity anchor because Nano Banana
          // gets multiple angles of the same face to triangulate against.
          extraProductImages: state.referenceImages.map(r => ({ base64: r.base64, mimeType: r.mimeType })),
          formatKey: state.formatKey,
        }),
      })
      const framesRaw = await framesRes.text()
      // Hero-frames returns frames as a bare string[] (public Supabase URLs),
      // not the object form the chat renderer expected. Normalise on receive.
      let framesData: { frames?: unknown; error?: string; identityRefsDebug?: { considered: string[]; loaded: number; fetchErrors: Array<{ url: string; status: number | string }> } } = {}
      try { framesData = framesRaw ? JSON.parse(framesRaw) : {} } catch { /* fall through */ }
      if (!framesRes.ok) throw new Error((framesData as { error?: string }).error || `Frame generation failed (${framesRes.status})`)
      const rawFrames = Array.isArray(framesData.frames) ? framesData.frames : []
      const frames: HeroFrame[] = rawFrames
        .map((f: unknown): HeroFrame | null => {
          if (typeof f === 'string') return { url: f }
          if (f && typeof f === 'object' && 'url' in f && typeof (f as { url: unknown }).url === 'string') {
            return { url: (f as { url: string }).url }
          }
          return null
        })
        .filter((f): f is HeroFrame => f !== null)
      if (!frames.length) throw new Error('No frames returned')

      // Compose a debug caption for the frames bubble when the caller picked
      // an influencer — so face-drift issues are diagnosable without server logs.
      let debugCaption: string | undefined
      if (influencerIdOut && framesData.identityRefsDebug) {
        const d = framesData.identityRefsDebug
        if (d.loaded === 0) {
          debugCaption = `⚠️ Nano Banana got 0 identity refs — face will drift. Considered ${d.considered.length} URL(s); ${d.fetchErrors.length} failed to fetch${d.fetchErrors[0] ? ` (${d.fetchErrors[0].status})` : ''}. Check character_sheet_url / portrait_url on this Studio persona.`
        } else {
          debugCaption = `Identity refs sent to Nano Banana: ${d.loaded}${d.fetchErrors.length ? ` (${d.fetchErrors.length} failed to fetch)` : ''}`
        }
      }

      // Replace the "rendering" bubble with a picker. onPickFrame is a
      // closure that kicks off the animate step for the chosen frame.
      const onPickFrame = async (selectedFrameUrl: string) => {
        // Lock the picker in this message.
        patchMsg(framesMsgId, { pickedFrameUrl: selectedFrameUrl })

        // ── Step 3: animate the picked frame ─────────────────────
        const animateMsgId = pushMsg({ role: 'assistant', kind: 'rendering', text: 'Rendering your video… usually about 2 minutes.' })
        try {
          const animRes = await fetch('/api/ugc/animate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              selectedFrameUrl,
              script: activeScript,
              ugcType: 'image-with-voiceover',
              duration: state.duration,
              productName: state.productName,
              productDescription: state.productDescription || state.direction || state.productName,
              benefits: state.direction || state.productDescription,
              callToAction: 'Shop now',
              avatarGender: 'Female',
              customInstructions: enrichedDirection || undefined,
              language: state.language,
              aspect: state.aspect,
              productImageBase64: state.productImage?.base64 || undefined,
              productImageMimeType: state.productImage?.mimeType || undefined,
              extraProductImages: state.referenceImages.map(r => ({ base64: r.base64, mimeType: r.mimeType })),
              resolution: state.resolution,
              engine: state.engine,
              videoDirection: enrichedDirection || undefined,
            }),
          })
          const animData = await animRes.json()
          if (!animRes.ok) throw new Error(animData.error || 'Video generation failed')

          // Server may return either a completed video or an in-progress
          // one that needs polling. Hand it to the parent's onGenerate so
          // it can wire the response into UI state + credit balance.
          await onGenerate({
            ...state,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            __animateResponse: animData,
          } as BuilderState & { __animateResponse: unknown })

          const videoUrl: string | undefined = animData?.components?.video?.videoUrl
          if (videoUrl) {
            patchMsg(animateMsgId, { kind: 'video', videoUrl, text: undefined })
          } else {
            patchMsg(animateMsgId, { kind: 'text', text: 'Video submitted — it will appear in your Library once rendering finishes.' })
          }
        } catch (err) {
          patchMsg(animateMsgId, { kind: 'error', text: err instanceof Error ? err.message : 'Video generation failed' })
        } finally {
          // Release the guard: animate is the last stage of the pipeline,
          // success or fail. User can now Generate again (or tweak the
          // script and re-run frames+animate on the same conversation).
          setBusy(false)
        }
      }

      patchMsg(framesMsgId, {
        kind: 'frames',
        text: debugCaption
          ? `Pick your favourite starting frame — I'll animate it into a full video.\n\n${debugCaption}`
          : 'Pick your favourite starting frame — I\'ll animate it into a full video.',
        frames,
        onPickFrame,
      })
      } // end _runFramesAndAnimate

      // Show the script bubble now, with Tweak enabled. On rerun the same
      // frames+animate pipeline fires with the edited script.
      patchMsg(scriptMsgId, {
        kind: 'script',
        text: undefined,
        script: initialScript,
        onScriptChange: next => patchMsg(scriptMsgId, { script: next }),
        onScriptRerun: next => {
          // Rerun kicks off a fresh frames+animate pass — set the guard
          // again so a second Generate press or another rerun can't
          // interleave with it.
          setBusy(true)
          void runFramesAndAnimate(next).catch(err => {
            pushMsg({ role: 'assistant', kind: 'error', text: err instanceof Error ? err.message : 'Rerun failed' })
            setBusy(false)
          })
        },
      })

      // Kick off the first frames+animate pass with the AI-drafted script.
      await runFramesAndAnimate(initialScript)
    } catch (e) {
      pushMsg({ role: 'assistant', kind: 'error', text: e instanceof Error ? e.message : 'Generation failed' })
      setBusy(false)
    }
  }

  // Ingest one or more image files into state.referenceImages. Shared by
  // the drop zone, the paste handler, and the ReferencesSheet upload
  // tile — so wherever an image comes from, it lands in the same slot.
  const [dragOver, setDragOver] = useState(false)
  async function ingestRefFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!list.length) return
    const out: BuilderState['referenceImages'] = []
    for (const file of list) {
      const buf = await file.arrayBuffer()
      out.push({
        base64: Buffer.from(buf).toString('base64'),
        mimeType: file.type,
        previewUrl: URL.createObjectURL(file),
      })
    }
    setState(s => ({ ...s, referenceImages: [...s.referenceImages, ...out].slice(0, 6) }))
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!dragOver) setDragOver(true) }}
      onDragLeave={e => {
        // Only clear if the drag left the wrapper entirely (not just moved to a child).
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length) void ingestRefFiles(e.dataTransfer.files)
      }}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        flex: 1, minHeight: 0, height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Drop-target hint overlay */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 12, zIndex: 20,
          borderRadius: 14, border: '2px dashed var(--ink)',
          background: 'rgba(0,0,0,0.04)',
          display: 'grid', placeItems: 'center',
          pointerEvents: 'none',
          color: 'var(--ink)', fontSize: 14, fontWeight: 600,
        }}>
          Drop to attach as reference image
        </div>
      )}
      <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0, height: '100%',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {/* ── Thread ───────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, minHeight: 0,
          overflowY: 'auto',
          padding: '32px 20px 16px',
        }}
      >
        <div style={{
          maxWidth: 760, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: '100%',
        }}>
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map(m => <ChatBubble key={m.id} message={m} />)
          )}
        </div>
      </div>

      {/* ── Composer ─────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        padding: '12px 20px max(12px, env(safe-area-inset-bottom, 12px))',
      }}>
      <div style={{
        maxWidth: 760, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Inline panels — one at a time above the chip row */}
        {openPanel === 'settings' && (
          <SettingsSheet
            state={state}
            onChange={patch => setState(s => ({ ...s, ...patch }))}
            onClose={() => setOpenPanel(null)}
          />
        )}
        {openPanel === 'product' && (
          <ProductSheet
            products={products}
            selectedName={state.productName}
            onPick={async p => {
              setOpenPanel(null)
              // Fetch the saved-product image and convert to base64 — the
              // hero-frames endpoint takes base64 + mimeType, not a URL.
              // Without this the endpoint saw no product and generated
              // frames without the packaging reference.
              let img: BuilderState['productImage'] | undefined
              if (p.image_url) {
                try {
                  const r = await fetch(p.image_url)
                  if (r.ok) {
                    const buf = await r.arrayBuffer()
                    img = {
                      base64: Buffer.from(buf).toString('base64'),
                      mimeType: r.headers.get('content-type') || 'image/jpeg',
                      url: p.image_url,
                    }
                  }
                } catch { /* fall back to name-only */ }
              }
              setState(s => ({
                ...s,
                productName: p.name,
                productImage: img ?? s.productImage,
              }))
            }}
            onUpload={u => {
              setState(s => ({
                ...s,
                productName: u.name,
                productImage: { base64: u.base64, mimeType: u.mimeType, url: u.previewUrl },
              }))
              setOpenPanel(null)
            }}
            onClose={() => setOpenPanel(null)}
          />
        )}
        {openPanel === 'refs' && (
          <ReferencesSheet
            images={state.referenceImages}
            onAdd={imgs => setState(s => ({ ...s, referenceImages: [...s.referenceImages, ...imgs].slice(0, 6) }))}
            onRemove={idx => setState(s => ({ ...s, referenceImages: s.referenceImages.filter((_, i) => i !== idx) }))}
            onClose={() => setOpenPanel(null)}
          />
        )}
        {openPanel === 'creator' && (
          <CreatorSheet
            creators={creators}
            selectedId={state.creatorId}
            onPick={async c => {
              setOpenPanel(null)
              // Auto — clear both ids so the pipeline casts a fresh character.
              if (!c) {
                setState(s => ({ ...s, creatorId: undefined, creatorName: 'Auto', bridgedActorId: undefined, creatorPhotoUrl: undefined }))
                return
              }
              // Set the pick immediately so the chip label updates even if
              // the bridge call is slow. Stash the imageUrl for influencers
              // as the canonical portrait we'll pass to hero-frames.
              setState(s => ({
                ...s,
                creatorId: c.id,
                creatorName: c.name,
                bridgedActorId: undefined,
                creatorPhotoUrl: c.source === 'influencer' ? c.imageUrl : undefined,
              }))
              // For influencers, bridge to a saved-actor row via /use-in-ugc.
              // The returned actor.id is what hero-frames reads to reproduce
              // the exact locked character prompt — without this, we only get
              // weak gallery refs and the face drifts.
              if (c.source === 'influencer') {
                setBridgingCreator(true)
                try {
                  const supabase = getSupabase()
                  const { data: sess } = await supabase!.auth.getSession()
                  const token = sess?.session?.access_token
                  if (!token) return
                  const [, rawId] = c.id.split(':')
                  const res = await fetch(`/api/influencers/${rawId}/use-in-ugc`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  const data = await res.json().catch(() => ({}))
                  if (res.ok && data?.actor?.id) {
                    setState(s => ({ ...s, bridgedActorId: data.actor.id }))
                  }
                } catch { /* soft-fail — Generate will re-attempt the bridge inline */ }
                finally { setBridgingCreator(false) }
              }
            }}
            onClose={() => setOpenPanel(null)}
          />
        )}

        {/* Chip toolbar — always visible, tap to cycle */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            value={`${state.duration}s`}
            onClick={() => setState(s => ({ ...s, duration: cycle([5, 10, 15, 20, 30], s.duration) as BuilderState['duration'] }))}
          />
          <Chip
            value={state.resolution.toUpperCase()}
            onClick={() => setState(s => {
              const opts = s.engine === 'seedance-mini' ? ['480p', '720p']
                : s.engine === 'seedance-2-5' ? ['720p', '1080p']
                : ['720p', '1080p', '4k']
              // If current resolution isn't in the legal set (e.g. 4k on 2.5),
              // start from the first legal option instead of wrapping to it.
              const start = opts.includes(s.resolution) ? s.resolution : opts[0]
              return { ...s, resolution: cycle(opts, start) as BuilderState['resolution'] }
            })}
          />
          <Chip
            value={aspectShort(state.aspect)}
            onClick={() => setState(s => ({ ...s, aspect: cycle(['portrait', 'square', 'landscape'], s.aspect) as BuilderState['aspect'] }))}
          />
          <Chip
            value={state.engine === 'seedance-mini' ? 'Mini' : state.engine === 'seedance-2-5' ? '2.5 · Premium' : 'Seedance 2.0'}
            onClick={() => setState(s => {
              // Cycle: 2.0 → 2.5 → Mini → 2.0
              const order: BuilderState['engine'][] = ['seedance-2', 'seedance-2-5', 'seedance-mini']
              const nextEngine = order[(order.indexOf(s.engine) + 1) % order.length]
              // Engine-specific resolution caps: mini→720p, 2.5→1080p.
              const nextRes: BuilderState['resolution'] =
                nextEngine === 'seedance-mini' && (s.resolution === '1080p' || s.resolution === '4k') ? '720p'
                : nextEngine === 'seedance-2-5' && s.resolution === '4k' ? '1080p'
                : s.resolution
              return { ...s, engine: nextEngine, resolution: nextRes }
            })}
          />
          <button
            type="button"
            onClick={() => setOpenPanel(p => p === 'settings' ? null : 'settings')}
            aria-label="More settings"
            style={{
              padding: '5px 10px', borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--ink-mute)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {openPanel === 'settings' ? '– Less' : '+ More'}
          </button>
        </div>

        {/* Attach row: product + creator badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <AttachChip
            icon={<Package size={12} />}
            label={state.productName || 'Attach product'}
            active={!!state.productName}
            onClick={() => setOpenPanel(p => p === 'product' ? null : 'product')}
          />
          <AttachChip
            icon={bridgingCreator ? <Loader2 size={12} className="animate-spin" /> : <User2 size={12} />}
            label={
              bridgingCreator ? `Attaching ${state.creatorName}…`
              : state.creatorName && state.creatorName !== 'Auto' ? state.creatorName
              : 'Pick creator'
            }
            active={!!state.creatorId}
            onClick={() => setOpenPanel(p => p === 'creator' ? null : 'creator')}
          />
          <AttachChip
            icon={<Images size={12} />}
            label={state.referenceImages.length > 0 ? `${state.referenceImages.length} reference${state.referenceImages.length === 1 ? '' : 's'}` : 'Add references'}
            active={state.referenceImages.length > 0}
            onClick={() => setOpenPanel(p => p === 'refs' ? null : 'refs')}
          />
        </div>

        {/* Ref chips row — one @imageN chip per attached reference */}
        {state.referenceImages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {state.referenceImages.map((img, i) => (
              <div
                key={img.previewUrl}
                title={`Reference ${i + 1} — mention as @image${i + 1} in the brief`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px 3px 3px', borderRadius: 999,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  fontSize: 11.5, fontWeight: 600, color: 'var(--ink)',
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={`@image${i + 1}`}
                  onClick={() => setComposer(c => c + (c && !c.endsWith(' ') ? ' ' : '') + `@image${i + 1} `)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    objectFit: 'cover', cursor: 'pointer',
                  }}
                />
                <span
                  onClick={() => setComposer(c => c + (c && !c.endsWith(' ') ? ' ' : '') + `@image${i + 1} `)}
                  style={{ cursor: 'pointer' }}
                >
                  @image{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setState(s => ({ ...s, referenceImages: s.referenceImages.filter((_, j) => j !== i) }))}
                  aria-label="Remove reference"
                  style={{
                    marginLeft: 2,
                    width: 16, height: 16, borderRadius: '50%',
                    border: 'none', cursor: 'pointer',
                    background: 'transparent', color: 'var(--ink-mute)',
                    display: 'grid', placeItems: 'center',
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea + send */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={composer}
            onChange={e => setComposer(e.target.value)}
            onPaste={e => {
              // Grab any images from the clipboard payload — the drop
              // ingest handler doubles as the paste ingest handler.
              const files: File[] = []
              for (const item of Array.from(e.clipboardData.items)) {
                if (item.kind === 'file') {
                  const f = item.getAsFile()
                  if (f && f.type.startsWith('image/')) files.push(f)
                }
              }
              if (files.length) {
                e.preventDefault()
                void ingestRefFiles(files)
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={isLoading}
            rows={2}
            placeholder="Describe the ad… (e.g. 'morning routine, mid-20s brunette, hero shot of the bottle at the end')"
            style={{
              flex: 1, minWidth: 0,
              padding: '10px 12px',
              fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--ink)',
              outline: 'none', resize: 'none',
              maxHeight: 140,
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={parsing ? 'Thinking' : 'Send'}
            style={{
              position: 'relative',
              flexShrink: 0,
              width: 42, height: 42, borderRadius: 12,
              background: parsing ? 'var(--ink)' : (canSend ? 'var(--ink)' : 'var(--surface-2)'),
              color: canSend || parsing ? 'var(--on-ink)' : 'var(--ink-mute)',
              border: 'none',
              display: 'grid', placeItems: 'center',
              cursor: parsing ? 'wait' : (canSend ? 'pointer' : 'not-allowed'),
              overflow: 'hidden',
              transition: 'background 0.2s',
            }}
          >
            {parsing ? <ThinkingIndicator /> : <Send size={16} />}
          </button>
        </div>

        {/* Bottom action row — Generate button + cost */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, paddingTop: 4,
        }}>
          <div style={{ fontSize: 11.5, color: busy ? 'var(--ink)' : 'var(--ink-mute)', fontFamily: 'var(--font-mono, monospace)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {busy ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                1 render running…
              </>
            ) : (
              <>{cost} cr · {creditBalance.toLocaleString()} balance</>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || isLoading || !state.productName.trim() || cost > creditBalance}
            title={busy ? 'A render is already running — wait for it to finish or pick a frame' : undefined}
            style={{
              padding: '9px 18px', borderRadius: 10,
              background: !busy && state.productName.trim() && cost <= creditBalance ? 'var(--ink)' : 'var(--surface-2)',
              color: !busy && state.productName.trim() && cost <= creditBalance ? 'var(--on-ink)' : 'var(--ink-mute)',
              border: 'none',
              fontSize: 13, fontWeight: 700,
              cursor: busy || isLoading || !state.productName.trim() || cost > creditBalance ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {busy || isLoading ? <><Loader2 size={13} className="animate-spin" /> Running…</> : <><Sparkles size={13} /> Generate</>}
          </button>
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}

// ── Bubbles + empty state ─────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: 24, textAlign: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'var(--surface-2, rgba(0,0,0,0.05))',
        display: 'grid', placeItems: 'center',
        color: 'var(--ink-mute)',
      }}>
        <Sparkles size={20} />
      </div>
      <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 22, color: 'var(--ink)' }}>
        What are we making?
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--ink-mute)', maxWidth: 340, lineHeight: 1.5 }}>
        Describe your ad in your own words. I&apos;ll fill in the settings.
        You can always tweak the chips below before hitting Generate.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, maxWidth: 340, width: '100%' }}>
        {[
          '"Skincare ad, mid-20s brunette, morning routine, 10s"',
          '"Cinematic unbox for my headphones, wide shots, no talking"',
          '"POV creator trying the product for the first time"',
        ].map(ex => (
          <div key={ex} style={{
            fontSize: 12.5, color: 'var(--ink-mute)',
            padding: '8px 12px', borderRadius: 10,
            background: 'var(--surface-2, rgba(0,0,0,0.03))',
            border: '1px solid var(--border-soft, var(--border))',
            fontFamily: 'var(--font-serif, Georgia, serif)',
            fontStyle: 'italic',
          }}>
            {ex}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatBubble({ message: m }: { message: Message }) {
  const [scriptOpen, setScriptOpen] = useState(false)
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null)
  const isUser = m.role === 'user'
  if (m.kind === 'script') {
    return <ScriptBubble m={m} scriptOpen={scriptOpen} setScriptOpen={setScriptOpen} />
  }
  if (m.kind === 'rendering') {
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
        <BubbleShell isUser={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-mute)', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" />
            {m.text ?? 'Rendering…'}
          </div>
        </BubbleShell>
      </div>
    )
  }
  if (m.kind === 'frames') {
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '100%' }}>
        <BubbleShell isUser={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {m.text && (
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{m.text}</div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 8,
            }}>
              {m.frames?.map((f, i) => {
                const picked = m.pickedFrameUrl === f.url
                const anyPicked = !!m.pickedFrameUrl
                return (
                  <div key={f.url + i} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      disabled={anyPicked && !picked}
                      onClick={() => !anyPicked && m.onPickFrame?.(f.url)}
                      style={{
                        width: '100%',
                        padding: 4, borderRadius: 10,
                        border: `2px solid ${picked ? 'var(--ink)' : 'transparent'}`,
                        background: 'var(--surface)',
                        cursor: anyPicked ? (picked ? 'default' : 'not-allowed') : 'pointer',
                        opacity: anyPicked && !picked ? 0.35 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <div style={{ aspectRatio: '9/16', borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt={`Frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    </button>
                    {/* Zoom button — sits over the tile, doesn't trigger pick */}
                    <button
                      type="button"
                      aria-label="Zoom frame"
                      onClick={e => { e.stopPropagation(); setZoomedUrl(f.url) }}
                      style={{
                        position: 'absolute',
                        top: 8, right: 8,
                        width: 28, height: 28, borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(6px)',
                        color: '#fff',
                        display: 'grid', placeItems: 'center',
                        cursor: 'pointer',
                        opacity: anyPicked && !picked ? 0.4 : 0.85,
                        transition: 'opacity 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = anyPicked && !picked ? '0.4' : '0.85'; e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      <ZoomIn size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
            {m.pickedFrameUrl && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', fontStyle: 'italic' }}>Picked — starting the render…</div>
            )}
          </div>
        </BubbleShell>
        {zoomedUrl && <FrameLightbox url={zoomedUrl} onClose={() => setZoomedUrl(null)} />}
      </div>
    )
  }
  if (m.kind === 'video') {
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
        <BubbleShell isUser={false}>
          {m.videoUrl && (
            <video
              src={m.videoUrl}
              poster={m.thumbUrl}
              controls
              playsInline
              style={{ width: '100%', maxWidth: 320, borderRadius: 10, display: 'block' }}
            />
          )}
        </BubbleShell>
      </div>
    )
  }
  if (m.kind === 'error') {
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
        <BubbleShell isUser={false} accent="danger">
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>{m.text}</div>
        </BubbleShell>
      </div>
    )
  }
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
      <BubbleShell isUser={isUser}>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: isUser ? 'var(--on-ink)' : 'var(--ink)', whiteSpace: 'pre-wrap' }}>
          {m.text}
        </div>
      </BubbleShell>
    </div>
  )
}

function BubbleShell({ isUser, accent, children }: { isUser: boolean; accent?: 'danger'; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 14,
      borderTopRightRadius: isUser ? 4 : 14,
      borderTopLeftRadius: isUser ? 14 : 4,
      background: isUser ? 'var(--ink)' : accent === 'danger' ? 'rgba(220, 38, 38, 0.06)' : 'var(--surface-2, rgba(0,0,0,0.04))',
      border: accent === 'danger' ? '1px solid var(--danger)' : 'none',
    }}>
      {children}
    </div>
  )
}

// ── Composer bits ─────────────────────────────────────────────────
// Script bubble — collapsed by default, expands to reveal the drafted
// script. When the message carries onScriptChange + onScriptRerun (i.e.
// this is the current, editable script), users get a Tweak toggle that
// swaps the display panel for a textarea + "Rerun frames" button.
function ScriptBubble({
  m,
  scriptOpen,
  setScriptOpen,
}: {
  m: Message
  scriptOpen: boolean
  setScriptOpen: (fn: (o: boolean) => boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.script ?? '')
  const editable = !!m.onScriptChange && !!m.onScriptRerun

  // Keep draft in sync if the parent overwrites the script (e.g. after
  // rerun completes with a slightly-cleaned version).
  useEffect(() => { if (!editing) setDraft(m.script ?? '') }, [m.script, editing])

  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
      <BubbleShell isUser={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setScriptOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: 0, border: 'none', background: 'none',
                cursor: 'pointer', color: 'var(--ink)',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                textAlign: 'left', flex: 1,
              }}
            >
              <span style={{ color: '#22c55e' }}>✓</span>
              Script ready
              <span style={{ marginLeft: 4, color: 'var(--ink-mute)', fontSize: 11, fontWeight: 500 }}>
                {scriptOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {editable && scriptOpen && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{
                  padding: '3px 10px', borderRadius: 999,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--ink-mute)', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Tweak
              </button>
            )}
          </div>
          {scriptOpen && !editing && m.script && (
            <div style={{
              marginTop: 4, padding: 10, borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)',
              whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              maxHeight: 320, overflowY: 'auto',
            }}>
              {m.script}
            </div>
          )}
          {scriptOpen && editing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={12}
                style={{
                  padding: 10, borderRadius: 8,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)',
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  outline: 'none', resize: 'vertical', maxHeight: 400,
                  width: '100%', minWidth: 0,
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(m.script ?? '') }}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--ink-mute)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!draft.trim() || draft === m.script}
                  onClick={() => {
                    m.onScriptChange?.(draft)
                    m.onScriptRerun?.(draft)
                    setEditing(false)
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: draft.trim() && draft !== m.script ? 'var(--ink)' : 'var(--surface-2)',
                    color: draft.trim() && draft !== m.script ? 'var(--on-ink)' : 'var(--ink-mute)',
                    fontSize: 12, fontWeight: 700,
                    cursor: draft.trim() && draft !== m.script ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  }}
                >
                  Save & regenerate frames
                </button>
              </div>
            </div>
          )}
        </div>
      </BubbleShell>
    </div>
  )
}

// Full-screen dark overlay showing a hero frame at its natural
// aspect. Click backdrop or Escape to close. Escapes any parent
// overflow because it's position: fixed on the viewport.
function FrameLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10, 10, 9, 0.92)',
        display: 'grid', placeItems: 'center',
        padding: 24,
        cursor: 'zoom-out',
        animation: 'ugc-lightbox-in 0.18s ease-out',
      }}
    >
      <style>{`@keyframes ugc-lightbox-in { from { opacity: 0 } to { opacity: 1 } }`}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Frame"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '92vw', maxHeight: '92vh',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          cursor: 'default',
        }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'fixed', top: 20, right: 20,
          width: 36, height: 36, borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

// Small in-button animation for the parse-brief loading state. Three
// dots orbit a central pulsing core — cadence tuned to feel alive but
// not frantic. Matches the GeneratingOverlay design language on a
// smaller scale so the app has one visual grammar for "thinking".
function ThinkingIndicator() {
  return (
    <span style={{
      position: 'relative',
      width: 22, height: 22,
      display: 'inline-block',
    }}>
      <style>{`
        @keyframes ugc-ti-a { from{transform:rotate(0deg) translateX(8px) rotate(0deg)} to{transform:rotate(360deg) translateX(8px) rotate(-360deg)} }
        @keyframes ugc-ti-b { from{transform:rotate(120deg) translateX(6px) rotate(-120deg)} to{transform:rotate(480deg) translateX(6px) rotate(-480deg)} }
        @keyframes ugc-ti-c { from{transform:rotate(240deg) translateX(9px) rotate(-240deg)} to{transform:rotate(600deg) translateX(9px) rotate(-600deg)} }
        @keyframes ugc-ti-core { 0%,100%{opacity:.9;transform:scale(1)} 50%{opacity:.55;transform:scale(1.25)} }
      `}</style>
      {/* Central pulsing core */}
      <span style={{
        position: 'absolute',
        top: '50%', left: '50%',
        marginTop: -3, marginLeft: -3,
        width: 6, height: 6, borderRadius: '50%',
        background: '#fff',
        animation: 'ugc-ti-core 1.4s ease-in-out infinite',
      }} />
      {/* Three orbiting dots at staggered radii + speeds */}
      <span style={{
        position: 'absolute',
        top: '50%', left: '50%',
        marginTop: -1.5, marginLeft: -1.5,
        width: 3, height: 3, borderRadius: '50%',
        background: '#c8a97e',
        animation: 'ugc-ti-a 1.6s linear infinite',
      }} />
      <span style={{
        position: 'absolute',
        top: '50%', left: '50%',
        marginTop: -1, marginLeft: -1,
        width: 2, height: 2, borderRadius: '50%',
        background: 'rgba(255,255,255,0.7)',
        animation: 'ugc-ti-b 1.1s linear infinite',
      }} />
      <span style={{
        position: 'absolute',
        top: '50%', left: '50%',
        marginTop: -1, marginLeft: -1,
        width: 2, height: 2, borderRadius: '50%',
        background: 'rgba(255,255,255,0.4)',
        animation: 'ugc-ti-c 2.1s linear infinite',
      }} />
    </span>
  )
}

function Chip({ value, onClick }: { value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 999,
        background: 'var(--surface-2, rgba(0,0,0,0.05))',
        border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 600, color: 'var(--ink)',
        fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      {value}
    </button>
  )
}

function AttachChip({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px 5px 8px', borderRadius: 999,
        border: `1px ${active ? 'solid' : 'dashed'} var(--border)`,
        background: active ? 'var(--surface-2, rgba(0,0,0,0.05))' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-mute)',
        fontSize: 12, fontWeight: 500,
        fontFamily: 'inherit', cursor: 'pointer',
        maxWidth: 200,
      }}
    >
      {icon}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function SettingsSheet({ state, onChange, onClose }: { state: BuilderState; onChange: (p: Partial<BuilderState>) => void; onClose: () => void }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>More settings</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
      </div>
      <SettingRow label="Duration">
        <SelectChips
          options={[
            { v: '5' as const,  l: '5s'  },
            { v: '10' as const, l: '10s' },
            { v: '15' as const, l: '15s' },
            { v: '20' as const, l: '20s' },
            { v: '30' as const, l: '30s' },
          ]}
          value={String(state.duration) as '5' | '10' | '15' | '20' | '30'}
          onChange={v => onChange({ duration: Number(v) as BuilderState['duration'] })}
        />
      </SettingRow>
      <SettingRow label="Quality">
        <SelectChips
          options={
            state.engine === 'seedance-mini'
              ? [{ v: '480p' as const, l: '480p' }, { v: '720p' as const, l: '720p' }]
            : state.engine === 'seedance-2-5'
              ? [{ v: '720p' as const, l: '720p' }, { v: '1080p' as const, l: '1080p' }]
              : [{ v: '720p' as const, l: '720p' }, { v: '1080p' as const, l: '1080p' }, { v: '4k' as const, l: '4K' }]
          }
          value={state.resolution as '480p' | '720p' | '1080p' | '4k'}
          onChange={v => onChange({ resolution: v })}
        />
      </SettingRow>
      <SettingRow label="Aspect">
        <SelectChips
          options={[
            { v: 'portrait' as const,  l: '9:16' },
            { v: 'tall45' as const,    l: '4:5'  },
            { v: 'square' as const,    l: '1:1'  },
            { v: 'landscape' as const, l: '16:9' },
          ]}
          value={state.aspect}
          onChange={v => onChange({ aspect: v })}
        />
      </SettingRow>
      <SettingRow label="Engine">
        <SelectChips
          options={[
            { v: 'seedance-2' as const,    l: 'Seedance 2.0'  },
            { v: 'seedance-2-5' as const,  l: '2.5 Premium'   },
            { v: 'seedance-mini' as const, l: 'Mini (fast)'   },
          ]}
          value={state.engine}
          onChange={v => {
            const nextRes: BuilderState['resolution'] =
              v === 'seedance-mini' && (state.resolution === '1080p' || state.resolution === '4k') ? '720p'
              : v === 'seedance-2-5' && state.resolution === '4k' ? '1080p'
              : state.resolution
            onChange({ engine: v, resolution: nextRes })
          }}
        />
      </SettingRow>
      <SettingRow label="Language">
        <SelectChips
          options={[
            { v: 'English' as const, l: 'EN' },
            { v: 'French' as const,  l: 'FR' },
            { v: 'Spanish' as const, l: 'ES' },
            { v: 'Arabic' as const,  l: 'AR' },
          ]}
          value={state.language as 'English' | 'French' | 'Spanish' | 'Arabic'}
          onChange={v => onChange({ language: v })}
        />
      </SettingRow>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-mute)', minWidth: 60 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function SelectChips<T extends string>({ options, value, onChange }: { options: Array<{ v: T; l: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{
          padding: '4px 10px', borderRadius: 999,
          border: `1px solid ${o.v === value ? 'var(--ink)' : 'var(--border)'}`,
          background: o.v === value ? 'var(--ink)' : 'var(--surface)',
          color: o.v === value ? 'var(--on-ink)' : 'var(--ink)',
          fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

// ── Attach sheets ──────────────────────────────────────────────────
function ProductSheet({ products, selectedName, onPick, onUpload, onClose }: {
  products: BrandProduct[]
  selectedName: string
  onPick: (p: BrandProduct) => void
  onUpload: (u: { name: string; base64: string; mimeType: string; previewUrl: string }) => void
  onClose: () => void
}) {
  // Two-step upload flow: pick a file, then confirm a name. Both are
  // required — the hero-frames pipeline needs a real image + label to
  // composite with, so a name-only path would just fail downstream.
  const [pending, setPending] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const buf = await file.arrayBuffer()
    const base64 = Buffer.from(buf).toString('base64')
    const previewUrl = URL.createObjectURL(file)
    setPending({ base64, mimeType: file.type, previewUrl })
    // Seed a name from the filename minus extension, user can edit before confirming.
    setName(file.name.replace(/\.[^.]+$/, '').slice(0, 60))
  }

  function confirm() {
    if (!pending || !name.trim()) return
    onUpload({ name: name.trim(), ...pending })
  }

  return (
    <div style={sheetShellStyle}>
      <SheetHeader title="Attach product" onClose={onClose} />

      {/* Saved-products grid (with an Upload tile prepended) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 8, maxHeight: 260, overflowY: 'auto',
      }}>
        {/* Upload tile — always first, opens the file picker */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            padding: 8, borderRadius: 10,
            border: '1.5px dashed var(--border)',
            background: 'var(--surface)',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
            textAlign: 'left', fontFamily: 'inherit',
          }}
        >
          <div style={{
            aspectRatio: '1/1', borderRadius: 8, background: 'var(--surface-2)',
            display: 'grid', placeItems: 'center', color: 'var(--ink-mute)',
          }}>
            <Upload size={18} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>Upload photo</div>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />

        {products.map(p => {
          const active = p.name === selectedName
          return (
            <button key={p.id} type="button" onClick={() => onPick(p)} style={{
              padding: 8, borderRadius: 10,
              border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
              background: 'var(--surface)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
              textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{
                aspectRatio: '1/1', borderRadius: 8, background: 'var(--surface-2)',
                overflow: 'hidden', display: 'grid', placeItems: 'center',
              }}>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Package size={20} color="var(--ink-mute)" />
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </div>
            </button>
          )
        })}
      </div>

      {products.length === 0 && !pending && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', padding: '10px 2px' }}>
          No saved products yet. Upload a product photo above, or save products from Brand Launch to reuse them here.
        </div>
      )}

      {/* Second step — name the freshly uploaded image, then confirm */}
      {pending && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: 10, borderRadius: 10,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending.previewUrl} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Product name"
            onKeyDown={e => { if (e.key === 'Enter') confirm() }}
            autoFocus
            style={{
              flex: 1, minWidth: 0,
              padding: '8px 11px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--ink)',
              fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={confirm}
            disabled={!name.trim()}
            style={{
              flexShrink: 0,
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: name.trim() ? 'var(--ink)' : 'var(--surface)',
              color: name.trim() ? 'var(--on-ink)' : 'var(--ink-mute)',
              fontSize: 12.5, fontWeight: 700,
              cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >
            Use
          </button>
        </div>
      )}
    </div>
  )
}

function ReferencesSheet({ images, onAdd, onRemove, onClose }: {
  images: BuilderState['referenceImages']
  onAdd: (imgs: BuilderState['referenceImages']) => void
  onRemove: (idx: number) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    const out: BuilderState['referenceImages'] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const buf = await file.arrayBuffer()
      out.push({
        base64: Buffer.from(buf).toString('base64'),
        mimeType: file.type,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (out.length) onAdd(out)
  }

  return (
    <div style={sheetShellStyle}>
      <SheetHeader title={`References ${images.length ? `(${images.length}/6)` : ''}`} onClose={onClose} />
      <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5, marginTop: -2 }}>
        Extra photos Nano Banana can use as visual context — packaging shots,
        additional product angles, mood-board images. Up to 6.
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
        gap: 8,
      }}>
        {images.map((img, i) => (
          <div key={img.previewUrl} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.previewUrl} alt={`Reference ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label="Remove"
              style={{
                position: 'absolute', top: 4, right: 4,
                width: 20, height: 20, borderRadius: '50%',
                border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.72)', color: '#fff',
                display: 'grid', placeItems: 'center',
              }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {images.length < 6 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              aspectRatio: '1/1', borderRadius: 8,
              border: '1.5px dashed var(--border)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              color: 'var(--ink-mute)', fontFamily: 'inherit',
            }}
          >
            <Upload size={18} />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>
    </div>
  )
}

function CreatorSheet({ creators, selectedId, onPick, onClose }: {
  creators: SavedCreator[]
  selectedId?: string
  onPick: (c: SavedCreator | null) => void
  onClose: () => void
}) {
  return (
    <div style={sheetShellStyle}>
      <SheetHeader title="Pick creator" onClose={onClose} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: 8, maxHeight: 260, overflowY: 'auto',
      }}>
        {/* Auto option */}
        <button type="button" onClick={() => onPick(null)} style={{
          padding: 6, borderRadius: 10,
          border: `1.5px solid ${!selectedId ? 'var(--ink)' : 'var(--border)'}`,
          background: 'var(--surface)', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit',
        }}>
          <div style={{
            aspectRatio: '9/16', borderRadius: 8, background: 'var(--surface-2)',
            display: 'grid', placeItems: 'center', color: 'var(--ink-mute)',
          }}>
            <Sparkles size={20} />
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>Auto</div>
        </button>
        {creators.map(c => {
          const active = c.id === selectedId
          return (
            <button key={c.id} type="button" onClick={() => onPick(c)} style={{
              padding: 6, borderRadius: 10,
              border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
              background: 'var(--surface)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit',
              position: 'relative',
            }}>
              <div style={{
                aspectRatio: '9/16', borderRadius: 8, background: 'var(--surface-2)',
                overflow: 'hidden', position: 'relative',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                />
                {c.source === 'influencer' && (
                  <span style={{
                    position: 'absolute', top: 4, left: 4,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(0,0,0,0.72)', color: '#fff',
                  }}>Studio</span>
                )}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                {c.name}
              </div>
            </button>
          )
        })}
      </div>
      {creators.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', padding: '10px 2px' }}>
          No saved creators yet. Auto will let the AI cast one for you, or save creators from previous renders to reuse them here.
        </div>
      )}
    </div>
  )
}

const sheetShellStyle: React.CSSProperties = {
  padding: '12px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  display: 'flex', flexDirection: 'column', gap: 10,
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{title}</span>
      <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────
// Strip Sonnet's occasional "Word count check / Revised / Final count"
// meta-commentary that leaks after the actual script. If we can find both
// a Revised block and the original, prefer the Revised block; otherwise
// truncate at the first "Word count" / "---" separator.
function cleanScript(raw: string): string {
  if (!raw) return ''
  const revised = raw.match(/\*\*?Revised:?\*\*?\s*([\s\S]+?)(?:\n\n\*\*|$)/i)
  if (revised) return revised[1].trim()
  // Otherwise cut off at the first "Word count" / "Final count" checkpoint.
  const cut = raw.split(/\n\s*(?:\*\*)?(?:Word count|Final count|Recount|---)/i)[0]
  return cut.trim()
}

function cycle<T>(list: T[], current: T): T {
  const i = list.indexOf(current)
  return list[(i + 1) % list.length]
}

function aspectShort(a: BuilderState['aspect']): string {
  return { portrait: '9:16', square: '1:1', landscape: '16:9', tall45: '4:5' }[a]
}

function estimateCost(s: BuilderState): number {
  // Delegate to the shared pricing module so the client estimate matches the
  // server charge to the cent. Add scroll-stop-hook surcharge on top.
  return ugcPackageCost(s.duration, s.resolution, s.engine) + (s.scrollStopHook ? 120 : 0)
}

function summariseChanges(patch: Partial<BuilderState>, prev: BuilderState): string {
  const lines: string[] = []
  if (patch.productName && patch.productName !== prev.productName) lines.push(`Product: **${patch.productName}**`)
  if (patch.creatorName && patch.creatorName !== prev.creatorName) lines.push(`Creator: ${patch.creatorName}`)
  if (patch.format && patch.format !== prev.format) lines.push(`Format: ${patch.format}`)
  if (patch.duration && patch.duration !== prev.duration) lines.push(`Length: ${patch.duration}s`)
  if (patch.resolution && patch.resolution !== prev.resolution) lines.push(`Quality: ${patch.resolution}`)
  if (patch.aspect && patch.aspect !== prev.aspect) lines.push(`Aspect: ${aspectShort(patch.aspect)}`)
  if (patch.direction && patch.direction !== prev.direction) lines.push(`Direction updated`)
  if (lines.length === 0) return "Got it — I've updated the settings below. Tweak anything, then hit Generate."
  return `Updated:\n${lines.map(l => '· ' + l).join('\n')}\n\nReady when you are — tap Generate below.`
}
