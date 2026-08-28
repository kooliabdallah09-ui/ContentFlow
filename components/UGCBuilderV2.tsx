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
import { Send, Loader2, Package, User2, Sparkles, X, Upload } from 'lucide-react'
import { getSupabase } from '@/lib/auth'
import { showError } from '@/lib/notifications'
import { ugcPackageCost } from '@/lib/ugc-pricing'

// ── Field shapes ────────────────────────────────────────────────────
export interface BuilderState {
  productName: string
  productDescription: string
  productImage?: { base64: string; mimeType: string; url?: string }
  creatorName: string
  creatorId?: string
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
  // shows a short "Script ready" chip with an expand toggle.
  script?: string
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
  const [openPanel, setOpenPanel] = useState<'settings' | 'product' | 'creator' | null>(null)
  const [products, setProducts] = useState<BrandProduct[]>([])
  const [creators, setCreators] = useState<SavedCreator[]>([])
  const [libLoaded, setLibLoaded] = useState(false)
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
    if (!state.productName.trim()) {
      showError('Product needed', 'Tell me what product this ad is for first — describe it in the chat, or attach a product below.')
      return
    }
    try {
      const supabase = getSupabase()
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      // Split creator id back into source + underlying id.
      const [creatorSource, creatorRawId] = state.creatorId?.split(':') ?? []

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
          customInstructions: state.direction || undefined,
          language: state.language,
        }),
      })
      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) throw new Error(scriptData.error || 'Script generation failed')
      const script: string = cleanScript(scriptData.script)
      patchMsg(scriptMsgId, { kind: 'script', text: undefined, script })

      // ── Step 2: hero-frames (4 candidates) ───────────────────────
      const framesMsgId = pushMsg({ role: 'assistant', kind: 'rendering', text: 'Casting your creator and rendering 4 starting frames…' })
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
          videoDirection: state.direction || undefined,
          script,
          savedActorId:   creatorSource === 'actor'      ? creatorRawId : undefined,
          influencerId:   creatorSource === 'influencer' ? creatorRawId : undefined,
          formatKey: state.formatKey,
        }),
      })
      const framesRaw = await framesRes.text()
      let framesData: { frames?: Array<{ url: string; caption?: string }>; error?: string } = {}
      try { framesData = framesRaw ? JSON.parse(framesRaw) : {} } catch { /* fall through */ }
      if (!framesRes.ok) throw new Error(framesData.error || `Frame generation failed (${framesRes.status})`)
      if (!framesData.frames?.length) throw new Error('No frames returned')
      const frames = framesData.frames

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
              script,
              ugcType: 'image-with-voiceover',
              duration: state.duration,
              productName: state.productName,
              productDescription: state.productDescription || state.direction || state.productName,
              benefits: state.direction || state.productDescription,
              callToAction: 'Shop now',
              avatarGender: 'Female',
              customInstructions: state.direction || undefined,
              language: state.language,
              aspect: state.aspect,
              productImageBase64: state.productImage?.base64 || undefined,
              productImageMimeType: state.productImage?.mimeType || undefined,
              resolution: state.resolution,
              engine: state.engine,
              videoDirection: state.direction || undefined,
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
        }
      }

      patchMsg(framesMsgId, {
        kind: 'frames',
        text: 'Pick your favourite starting frame — I\'ll animate it into a full video.',
        frames,
        onPickFrame,
      })
    } catch (e) {
      pushMsg({ role: 'assistant', kind: 'error', text: e instanceof Error ? e.message : 'Generation failed' })
    }
  }

  return (
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
            onPick={p => {
              setState(s => ({
                ...s,
                productName: p.name,
                productImage: p.image_url ? { base64: '', mimeType: 'image/jpeg', url: p.image_url } : s.productImage,
              }))
              setOpenPanel(null)
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
        {openPanel === 'creator' && (
          <CreatorSheet
            creators={creators}
            selectedId={state.creatorId}
            onPick={c => {
              setState(s => ({ ...s, creatorId: c?.id, creatorName: c?.name ?? 'Auto' }))
              setOpenPanel(null)
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
            icon={<User2 size={12} />}
            label={state.creatorName && state.creatorName !== 'Auto' ? state.creatorName : 'Pick creator'}
            active={!!state.creatorId}
            onClick={() => setOpenPanel(p => p === 'creator' ? null : 'creator')}
          />
        </div>

        {/* Textarea + send */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={composer}
            onChange={e => setComposer(e.target.value)}
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
          <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono, monospace)' }}>
            {cost} cr · {creditBalance.toLocaleString()} balance
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !state.productName.trim() || cost > creditBalance}
            style={{
              padding: '9px 18px', borderRadius: 10,
              background: state.productName.trim() && cost <= creditBalance ? 'var(--ink)' : 'var(--surface-2)',
              color: state.productName.trim() && cost <= creditBalance ? 'var(--on-ink)' : 'var(--ink-mute)',
              border: 'none',
              fontSize: 13, fontWeight: 700,
              cursor: state.productName.trim() && cost <= creditBalance && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isLoading ? <><Loader2 size={13} className="animate-spin" /> Rendering…</> : <><Sparkles size={13} /> Generate</>}
          </button>
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
  const isUser = m.role === 'user'
  if (m.kind === 'script') {
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
        <BubbleShell isUser={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              onClick={() => setScriptOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: 0, border: 'none', background: 'none',
                cursor: 'pointer', color: 'var(--ink)',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span style={{ color: '#22c55e' }}>✓</span>
              Script ready
              <span style={{ marginLeft: 4, color: 'var(--ink-mute)', fontSize: 11, fontWeight: 500 }}>
                {scriptOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {scriptOpen && m.script && (
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
          </div>
        </BubbleShell>
      </div>
    )
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
                  <button
                    key={f.url + i}
                    type="button"
                    disabled={anyPicked && !picked}
                    onClick={() => !anyPicked && m.onPickFrame?.(f.url)}
                    style={{
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
                )
              })}
            </div>
            {m.pickedFrameUrl && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', fontStyle: 'italic' }}>Picked — starting the render…</div>
            )}
          </div>
        </BubbleShell>
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
