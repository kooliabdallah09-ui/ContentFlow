'use client'

import { Download, Copy, Loader, Film } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface VideoComponent {
  videoId?: string
  videoUrl?: string
  videoUrls?: string[]                       // Chained Kling clips, in order. Length 1 normally, 2 for 20s.
  status: 'processing' | 'completed' | 'failed'
  estimatedDuration?: number
  duration?: number                           // TOTAL video duration (sum of all clips)
  provider?: 'heygen' | 'sora-2' | 'seedance-2'
  chainedIds?: string[]                       // Additional Kling prediction ids to poll alongside videoId
  error?: string  // Surfaced when the A-roll generation fails — content policy, billing, etc.
}

interface BrollClip {
  taskId: string
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  label?: string
}

interface CutawayClip {
  slot: string
  startAt: number
  duration: number
  predictionId?: string       // Seedance job ID
  videoUrl?: string           // Set once poll returns completed
  status?: 'processing' | 'completed' | 'failed'
  startImageUrl?: string
  error?: string
}

interface CrushShotClip {
  index: number
  methodKey: string
  predictionId: string
  durationSec: number
  frameUrl?: string
  videoUrl?: string
  status?: 'processing' | 'completed' | 'failed'
  error?: string
}

interface ScrollStopHookPayload {
  jobId: string             // Seedance prediction id for the hook clip
  frameUrl: string          // First-frame preview (used while the clip renders)
  hookKey: string
  durationSec: number       // Rendered length (Seedance floor is 3s)
  trimToSec?: number        // Target length after Shotstack trim (design target: 1.5s)
}

interface HookClipState {
  jobId: string
  frameUrl: string
  trimToSec: number
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}

interface UGCComponent {
  image?: { url: string; id: string }
  video?: VideoComponent
  broll?: BrollClip[]
  cutaways?: CutawayClip[]
  multiShot?: boolean
  multiShotMode?: 'overlay' | 'crush-test-concat'
  crushShots?: CrushShotClip[]
  script?: string
  audioOverlayUrl?: string  // Hero tier: ElevenLabs voice to overlay on the muted Sora video
  language?: string         // ISO-639-1 code — drives Whisper transcription hint
  aspect?: 'portrait' | 'square' | 'landscape'  // Drives the stitch output size + preview aspect
  // Scroll-stop hook v1 (admin). When present, preview must poll BOTH the
  // hook clip and the main clip, then submit a Shotstack render that trims
  // the hook to ~1.5s and concatenates it before the main clip.
  scrollStopHook?: ScrollStopHookPayload
}

interface UGCPackagePreviewProps {
  components: UGCComponent | null
  ugcType: string
  isLoading: boolean
  error?: string
  creditDeducted?: number
}

export default function UGCPackagePreview({ components, ugcType, isLoading, error, creditDeducted }: UGCPackagePreviewProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoComponent | null>(null)
  const [brolls, setBrolls] = useState<BrollClip[]>([])
  const [cutaways, setCutaways] = useState<CutawayClip[]>([])
  const [multiShot, setMultiShot] = useState(false)
  const [crushShots, setCrushShots] = useState<CrushShotClip[]>([])
  const [multiShotMode, setMultiShotMode] = useState<'overlay' | 'crush-test-concat' | null>(null)
  const crushFinalizeStartedRef = useRef(false)
  const [compositeRenderId, setCompositeRenderId] = useState<string | null>(null)
  const compositePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const compositeStartedRef = useRef(false)
  const [stitchRenderId, setStitchRenderId] = useState<string | null>(null)
  const [stitchStatus, setStitchStatus] = useState<'idle' | 'stitching' | 'completed' | 'failed'>('idle')
  const [stitchError, setStitchError] = useState<string | null>(null)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)
  const [audioOverlayUrl, setAudioOverlayUrl] = useState<string | undefined>(undefined)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Prediction ids we've already auto-retried for an async E005 flag —
  // prevents double-firing the retry endpoint from overlapping polls.
  const retriedIdsRef = useRef<Set<string>>(new Set())
  // Prediction ids we've already sent to /api/ugc/preserve (Drive backup).
  const preservedIdsRef = useRef<Set<string>>(new Set())

  // Replicate deletes render outputs within hours — push the mp4 to the
  // user's Google Drive the moment it completes so the Library copy is
  // permanent. Fire-and-forget; warns if Drive isn't connected.
  const preserveToDrive = async (predictionId: string, videoUrl: string) => {
    if (preservedIdsRef.current.has(predictionId)) return
    preservedIdsRef.current.add(predictionId)
    try {
      const { getSupabase } = await import('@/lib/auth')
      const supabase = getSupabase()
      const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
      const token = sess?.session?.access_token
      if (!token) return
      const res = await fetch('/api/ugc/preserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ predictionId, videoUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.needsDrive) {
        const { showError } = await import('@/lib/notifications')
        showError('Video not backed up', 'Connect Google Drive in Settings → Integrations to keep your videos — this file expires within hours. Download it now to be safe.')
      } else if (res.ok && data.fileId && !data.alreadyPreserved) {
        const { showSuccess } = await import('@/lib/notifications')
        showSuccess('Saved to Drive', 'Your video is safely stored in your ContentFlow folder.')
      }
    } catch { /* best-effort — the user can still download manually */ }
  }
  const stitchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stitchStartedRef = useRef(false)

  // ── Scroll-stop hook state ─────────────────────────────────────────
  // Independent from the crush-test/multishot flow: when a hook payload is
  // passed on components.scrollStopHook we poll BOTH the hook Seedance job
  // and the main clip's job, then submit a Shotstack render that trims the
  // hook to ~1.5s and concatenates it before the main clip.
  const [hookClip, setHookClip] = useState<HookClipState | null>(null)
  const [hookStitchRenderId, setHookStitchRenderId] = useState<string | null>(null)
  const [hookStitchStatus, setHookStitchStatus] = useState<'idle' | 'stitching' | 'completed' | 'failed'>('idle')
  const hookStitchStartedRef = useRef(false)
  const hookStitchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (components?.video) setVideo(components.video)
    if (components?.broll) setBrolls(components.broll)
    if (components?.audioOverlayUrl) setAudioOverlayUrl(components.audioOverlayUrl)
    if (components?.cutaways?.length) {
      setCutaways(components.cutaways.map(c => ({
        ...c,
        status: c.predictionId ? 'processing' : 'failed',
      })))
    }
    if (components?.multiShot) setMultiShot(true)
    if (components?.multiShotMode) setMultiShotMode(components.multiShotMode)
    if (components?.crushShots?.length) {
      setCrushShots(components.crushShots.map(s => ({
        ...s,
        status: s.predictionId ? 'processing' : 'failed',
      })))
    }
    if (components?.scrollStopHook?.jobId) {
      setHookClip({
        jobId: components.scrollStopHook.jobId,
        frameUrl: components.scrollStopHook.frameUrl,
        trimToSec: components.scrollStopHook.trimToSec ?? 1.5,
        status: 'processing',
      })
    }
  }, [components])

  // Poll each cutaway's Seedance job independently. Uses the same
  // /api/ugc/video-status endpoint that handles the anchor and legacy
  // B-rolls, passing provider=seedance-2 per cutaway.
  useEffect(() => {
    const processing = cutaways.filter(c => c.predictionId && c.status === 'processing')
    if (!processing.length) return
    const t = setInterval(async () => {
      const updates = await Promise.all(processing.map(async c => {
        try {
          const res = await fetch(`/api/ugc/video-status?videoId=${c.predictionId}&provider=seedance-2`)
          if (!res.ok) return null
          const data = await res.json()
          const v = data.video
          if (!v) return null
          if (v.status === 'completed' || v.status === 'failed') {
            return { predictionId: c.predictionId, status: v.status, videoUrl: v.videoUrl, error: v.error }
          }
          return null
        } catch { return null }
      }))
      const meaningful = updates.filter((u): u is NonNullable<typeof u> => !!u)
      if (meaningful.length) {
        setCutaways(prev => prev.map(c => {
          const u = meaningful.find(m => m.predictionId === c.predictionId)
          return u ? { ...c, status: u.status as 'completed' | 'failed', videoUrl: u.videoUrl, error: u.error } : c
        }))
      }
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutaways.map(c => `${c.predictionId}:${c.status}`).join('|')])

  // Crush-test multi-shot: poll each shot's Seedance job independently.
  useEffect(() => {
    if (multiShotMode !== 'crush-test-concat') return
    const processing = crushShots.filter(s => s.predictionId && s.status === 'processing')
    if (!processing.length) return
    const t = setInterval(async () => {
      const updates = await Promise.all(processing.map(async s => {
        try {
          const res = await fetch(`/api/ugc/video-status?videoId=${s.predictionId}&provider=seedance-2`)
          if (!res.ok) return null
          const data = await res.json()
          const v = data.video
          if (!v) return null
          if (v.status === 'completed' || v.status === 'failed') {
            return { predictionId: s.predictionId, status: v.status, videoUrl: v.videoUrl, error: v.error }
          }
          return null
        } catch { return null }
      }))
      const meaningful = updates.filter((u): u is NonNullable<typeof u> => !!u)
      if (meaningful.length) {
        setCrushShots(prev => prev.map(s => {
          const u = meaningful.find(m => m.predictionId === s.predictionId)
          return u ? { ...s, status: u.status as 'completed' | 'failed', videoUrl: u.videoUrl, error: u.error } : s
        }))
      }
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiShotMode, crushShots.map(s => `${s.predictionId}:${s.status}`).join('|')])

  // Crush-test finalize: once every shot is done, POST the ordered urls to
  // /api/ugc/motion-broll-multishot/finalize which submits a Shotstack
  // concat and returns a renderId; we then poll GET /api/ugc/stitch until
  // the mp4 is ready.
  useEffect(() => {
    if (multiShotMode !== 'crush-test-concat') return
    if (crushFinalizeStartedRef.current) return
    if (!crushShots.length) return
    if (crushShots.some(s => s.status === 'processing')) return
    const usable = crushShots.filter(s => s.status === 'completed' && s.videoUrl)
      .sort((a, b) => a.index - b.index)
    if (!usable.length) {
      crushFinalizeStartedRef.current = true
      setStitchStatus('failed')
      setStitchError('All crush shots failed')
      return
    }
    if (usable.length === 1) {
      crushFinalizeStartedRef.current = true
      setFinalVideoUrl(usable[0].videoUrl!)
      setStitchStatus('completed')
      // Also reflect on the anchor so the primary player picks it up.
      setVideo(prev => prev ? { ...prev, status: 'completed', videoUrl: usable[0].videoUrl } : prev)
      return
    }
    crushFinalizeStartedRef.current = true
    setStitchStatus('stitching')
    ;(async () => {
      try {
        const { getSupabase } = await import('@/lib/auth')
        const supabase = getSupabase()
        const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
        const token = sess?.session?.access_token
        if (!token) throw new Error('Not signed in')
        const aspect: 'portrait' | 'square' | 'landscape' = components?.aspect ?? 'portrait'
        const res = await fetch('/api/ugc/motion-broll-multishot/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            aspect,
            shots: usable.map(s => ({ videoUrl: s.videoUrl!, durationSec: s.durationSec })),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Finalize failed')
        if (data.singleShot && data.finalVideoUrl) {
          setFinalVideoUrl(data.finalVideoUrl)
          setStitchStatus('completed')
          return
        }
        if (!data.renderId) throw new Error('finalize: no renderId')
        setStitchRenderId(data.renderId)
      } catch (err) {
        setStitchStatus('failed')
        setStitchError(err instanceof Error ? err.message : 'Finalize failed')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiShotMode, crushShots.map(s => s.status).join('|')])

  // Poll the Shotstack stitch job for the crush-test concat.
  useEffect(() => {
    if (multiShotMode !== 'crush-test-concat') return
    if (!stitchRenderId || stitchStatus !== 'stitching') return
    stitchPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/stitch?renderId=${stitchRenderId}`)
        const data = await res.json()
        if (data.status === 'completed' && data.videoUrl) {
          setFinalVideoUrl(data.videoUrl)
          setStitchStatus('completed')
          if (stitchPollRef.current) clearInterval(stitchPollRef.current)
        } else if (data.status === 'failed') {
          setStitchStatus('failed')
          setStitchError(data.error || 'Stitch failed')
          if (stitchPollRef.current) clearInterval(stitchPollRef.current)
        }
      } catch { /* keep polling */ }
    }, 4000)
    return () => { if (stitchPollRef.current) clearInterval(stitchPollRef.current) }
  }, [multiShotMode, stitchRenderId, stitchStatus])

  // Main video + B-roll polling
  useEffect(() => {
    const videoProcessing = video?.videoId && video.status === 'processing'
    const brollProcessing = brolls.some(b => b.status === 'processing')
    if (!videoProcessing && !brollProcessing) return

    pollRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams()
        if (video?.videoId && video.status === 'processing') {
          params.set('videoId', video.videoId)
          if (video.provider) params.set('provider', video.provider)
          if (video.chainedIds?.length) params.set('chainedIds', video.chainedIds.join(','))
        }
        const processingBrolls = brolls.filter(b => b.status === 'processing')
        if (processingBrolls.length) params.set('brollTaskIds', processingBrolls.map(b => b.taskId).join(','))

        const res = await fetch(`/api/ugc/video-status?${params}`)
        const data = await res.json()

        if (data.video) {
          const v = data.video
          // Async sensitivity flag (E005): Seedance accepted the job then
          // flagged it mid-render. Auto-retry with the next grid from the
          // ladder — the server regridifies + resubmits, no extra charge.
          const isSensitive = v.status === 'failed'
            && /e005|flagged as sensitive|sensitive content/i.test(String(v.error ?? ''))
          if (isSensitive && video?.videoId && !retriedIdsRef.current.has(video.videoId)) {
            retriedIdsRef.current.add(video.videoId)
            try {
              const { getSupabase } = await import('@/lib/auth')
              const supabase = getSupabase()
              const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
              const token = sess?.session?.access_token
              if (token) {
                const retryRes = await fetch('/api/ugc/animate/retry', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ failedPredictionId: video.videoId }),
                })
                const retryData = await retryRes.json().catch(() => ({}))
                if (retryRes.ok && retryData.videoId) {
                  // Swap to the new prediction and keep polling.
                  setVideo(prev => prev ? { ...prev, videoId: retryData.videoId, status: 'processing', error: undefined } : prev)
                  return
                }
              }
            } catch { /* fall through to failed state */ }
          }
          if (v.status === 'completed' || v.status === 'failed') {
            if (v.status === 'completed' && v.videoUrl && video?.videoId) {
              // Back the render up to Drive before Replicate expires it.
              void preserveToDrive(video.videoId, v.videoUrl)
            }
            setVideo(prev => prev ? {
              ...prev,
              status: v.status,
              videoUrl: v.videoUrl,
              videoUrls: v.videoUrls,
              duration: v.duration ?? prev.duration,
              error: v.error,
            } : prev)
          }
        }

        if (data.broll?.length) {
          setBrolls(prev => prev.map(b => {
            const updated = data.broll.find((u: BrollClip) => u.taskId === b.taskId)
            return updated ? { ...b, status: updated.status, videoUrl: updated.videoUrl } : b
          }))
        }

        const allDone = (!video?.videoId || video.status !== 'processing' || data.video?.status === 'completed' || data.video?.status === 'failed')
          && (!brolls.some(b => b.status === 'processing') || data.broll?.every((b: BrollClip) => b.status === 'completed' || b.status === 'failed'))
        if (allDone) clearInterval(pollRef.current!)
      } catch {}
    }, 5000)

    return () => clearInterval(pollRef.current!)
  }, [video?.videoId, video?.status, brolls.length])

  // Single-shot path: anchor is the final video, no composite needed.
  // If a scroll-stop hook is attached, the hook-stitch effect below owns the
  // finalVideoUrl — don't short-circuit here.
  useEffect(() => {
    if (stitchStartedRef.current || compositeStartedRef.current) return
    if (multiShot) return
    if (hookClip) return
    if (video?.status !== 'completed' || !video.videoUrl) return
    stitchStartedRef.current = true
    setFinalVideoUrl(video.videoUrl)
    setStitchStatus('completed')
  }, [video?.status, video?.videoUrl, multiShot, hookClip])

  // ── Scroll-stop hook: poll the hook Seedance job ─────────────────
  useEffect(() => {
    if (!hookClip || hookClip.status !== 'processing') return
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/video-status?videoId=${hookClip.jobId}&provider=seedance-2`)
        if (!res.ok) return
        const data = await res.json()
        const v = data.video
        if (!v) return
        if (v.status === 'completed' || v.status === 'failed') {
          setHookClip(prev => prev ? {
            ...prev,
            status: v.status,
            videoUrl: v.videoUrl,
            error: v.error,
          } : prev)
        }
      } catch { /* keep polling */ }
    }, 5000)
    return () => clearInterval(t)
  }, [hookClip?.jobId, hookClip?.status])

  // ── Scroll-stop hook: once BOTH hook + main are ready, submit stitch ─
  // Fail-soft: if the hook failed, skip it and show the main clip alone
  // rather than blocking the whole video on hook render failure.
  useEffect(() => {
    if (!hookClip) return
    if (hookStitchStartedRef.current) return
    if (multiShot) return  // multishot/crush flows own their own stitch
    if (video?.status === 'processing' || video?.status === undefined) return
    if (hookClip.status === 'processing') return

    const mainOk = video?.status === 'completed' && !!video.videoUrl
    if (!mainOk) {
      // Main failed — nothing to show. Let the existing failed-state card render.
      hookStitchStartedRef.current = true
      return
    }
    const hookOk = hookClip.status === 'completed' && !!hookClip.videoUrl
    if (!hookOk) {
      // Hook failed — fall back to main clip only. Fail-soft.
      hookStitchStartedRef.current = true
      setFinalVideoUrl(video.videoUrl!)
      setStitchStatus('completed')
      return
    }

    hookStitchStartedRef.current = true
    setHookStitchStatus('stitching')
    setStitchStatus('stitching')
    ;(async () => {
      try {
        const { getSupabase } = await import('@/lib/auth')
        const supabase = getSupabase()
        const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
        const token = sess?.session?.access_token
        if (!token) throw new Error('Not signed in')
        const aspect: 'portrait' | 'square' | 'landscape' = components?.aspect ?? 'portrait'
        const res = await fetch('/api/ugc/scroll-stop-hook/stitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            hookUrl: hookClip.videoUrl,
            hookTrimTo: hookClip.trimToSec,
            mainUrl: video!.videoUrl,
            mainDuration: video!.duration ?? video!.estimatedDuration ?? 12,
            aspect,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.renderId) throw new Error(data.error || 'Hook stitch submit failed')
        setHookStitchRenderId(data.renderId)
      } catch (err) {
        // Fail-soft: main clip alone.
        console.warn('[scroll-stop-hook] stitch failed, falling back to main:', err)
        setHookStitchStatus('failed')
        setFinalVideoUrl(video!.videoUrl!)
        setStitchStatus('completed')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookClip?.status, video?.status, video?.videoUrl, multiShot])

  // Poll the Shotstack hook-stitch job.
  useEffect(() => {
    if (!hookStitchRenderId || hookStitchStatus !== 'stitching') return
    hookStitchPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/scroll-stop-hook/stitch?renderId=${hookStitchRenderId}`)
        const data = await res.json()
        if (data.status === 'completed' && data.videoUrl) {
          setFinalVideoUrl(data.videoUrl)
          setHookStitchStatus('completed')
          setStitchStatus('completed')
          if (hookStitchPollRef.current) clearInterval(hookStitchPollRef.current)
        } else if (data.status === 'failed') {
          // Fail-soft: main clip alone.
          console.warn('[scroll-stop-hook] stitch render failed, falling back to main')
          setHookStitchStatus('failed')
          if (video?.videoUrl) {
            setFinalVideoUrl(video.videoUrl)
            setStitchStatus('completed')
          } else {
            setStitchStatus('failed')
            setStitchError(data.error || 'Hook stitch failed')
          }
          if (hookStitchPollRef.current) clearInterval(hookStitchPollRef.current)
        }
      } catch { /* keep polling */ }
    }, 4000)
    return () => { if (hookStitchPollRef.current) clearInterval(hookStitchPollRef.current) }
  }, [hookStitchRenderId, hookStitchStatus, video?.videoUrl])

  // Multi-shot path: once anchor + every cutaway are done (or failed), fire
  // the Shotstack composite. We include only the cutaways that produced a
  // videoUrl. Voice comes from the anchor track, cuts overlay on top.
  useEffect(() => {
    if (compositeStartedRef.current || stitchStartedRef.current) return
    if (!multiShot) return
    if (multiShotMode === 'crush-test-concat') return
    if (video?.status !== 'completed' || !video.videoUrl) return
    // Wait for every cutaway to finish polling (either completed or failed).
    if (cutaways.some(c => c.status === 'processing')) return
    const usable = cutaways.filter(c => c.status === 'completed' && c.videoUrl)
    // If somehow every cutaway failed, fall back to the anchor as-is.
    if (!usable.length) {
      compositeStartedRef.current = true
      setFinalVideoUrl(video.videoUrl)
      setStitchStatus('completed')
      return
    }
    compositeStartedRef.current = true
    setStitchStatus('stitching')
    ;(async () => {
      try {
        const supabase = await import('@/lib/auth').then(m => m.getSupabase())
        const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
        const token = sess?.session?.access_token
        if (!token) throw new Error('Not signed in')
        const anchorRatio = components?.aspect === 'landscape' ? '16:9' : components?.aspect === 'square' ? '1:1' : '9:16'
        const res = await fetch('/api/ugc/multishot-composite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            anchorUrl: video.videoUrl,
            anchorDuration: video.duration ?? video.estimatedDuration ?? 10,
            aspectRatio: anchorRatio,
            cutaways: usable.map(c => ({
              videoUrl: c.videoUrl!,
              startAt: c.startAt,
              duration: c.duration,
              slot: c.slot,
            })),
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.renderId) throw new Error(data.error || 'Composite kickoff failed')
        setCompositeRenderId(data.renderId)
      } catch (err) {
        setStitchStatus('failed')
        setStitchError(err instanceof Error ? err.message : 'Composite failed')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiShot, video?.status, video?.videoUrl, cutaways.map(c => c.status).join('|')])

  // Poll the Shotstack composite until it produces a final MP4.
  useEffect(() => {
    if (!compositeRenderId || stitchStatus !== 'stitching') return
    compositePollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ugc/multishot-composite?renderId=${compositeRenderId}`)
        const data = await res.json()
        if (data.status === 'completed' && data.videoUrl) {
          setFinalVideoUrl(data.videoUrl)
          setStitchStatus('completed')
          if (compositePollRef.current) clearInterval(compositePollRef.current)
        } else if (data.status === 'failed') {
          setStitchStatus('failed')
          setStitchError(data.error || 'Composite failed')
          if (compositePollRef.current) clearInterval(compositePollRef.current)
        }
      } catch { /* keep polling */ }
    }, 4000)
    return () => { if (compositePollRef.current) clearInterval(compositePollRef.current) }
  }, [compositeRenderId, stitchStatus])

  const handleDownload = async (url: string, filename: string) => {
    setDownloading(filename)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = window.URL.createObjectURL(blob)
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(a.href)
    } catch {}
    finally { setDownloading(null) }
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // Pick the CSS aspect for the preview <video> elements based on what the
  // user generated. Square → 1/1, landscape → 16/9, default portrait → 9/16.
  const previewAspectRatio =
    components?.aspect === 'square'    ? '1 / 1' :
    components?.aspect === 'landscape' ? '16 / 9' :
                                         '9 / 16'

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
      <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '50%' }}>
        <Loader style={{ width: 28, height: 28, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
      </div>
      <p style={{ fontSize: '14px', color: 'var(--ink-dim)', textAlign: 'center' }}>Generating your UGC package…</p>
      <p style={{ fontSize: '12px', color: 'var(--ink-fade)', textAlign: 'center' }}>Writing the script, generating your avatar image…</p>
    </div>
  )

  if (error && !isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
      <p style={{ fontSize: '14px', color: 'var(--bad)', fontWeight: 600 }}>{error}</p>
      <p style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>Check your input and try again</p>
    </div>
  )

  if (!components) return (
    <div className="card" style={{ padding: '14px' }}>
      <div style={{
        aspectRatio: '0.62', borderRadius: 11,
        background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 9px, var(--surface-3) 9px 18px)',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, textAlign: 'center', padding: 20,
      }}>
        <Film style={{ width: 28, height: 28, color: 'var(--ink-faint)' }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          Your preview appears<br/>here as it renders.
        </span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Cost badge */}
      {creditDeducted !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 11,
          background: 'var(--hover)', border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Generation cost</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>
            {creditDeducted} cr
          </span>
        </div>
      )}

      {/* Script */}
      {components.script && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
              AI Script
            </h3>
            <button
              onClick={() => handleCopy(components.script!, 'script')}
              className="btn btn-ghost"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <Copy style={{ width: 12, height: 12 }} />
              {copied === 'script' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
            {components.script}
          </p>
        </div>
      )}

      {/* Image */}
      {components.image && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            Product Image
          </h3>
          <img
            src={components.image.url}
            alt="Generated product"
            style={{ width: '100%', borderRadius: 'var(--r-md)', marginBottom: '12px', maxHeight: '300px', objectFit: 'contain', background: 'var(--bg)' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => handleDownload(components.image!.url, `product-${Date.now()}.png`)} disabled={!!downloading} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
              <Download style={{ width: 14, height: 14 }} />
              {downloading === 'image' ? 'Downloading…' : 'Download'}
            </button>
            <button onClick={() => handleCopy(components.image!.url, 'image')} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
              <Copy style={{ width: 14, height: 14 }} />
              {copied === 'image' ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
      )}


      {/* Final stitched video */}
      {stitchStatus !== 'idle' && (
        <div className="card" style={{ padding: '20px', border: '1px solid var(--accent)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            ✦ Final Video
          </h3>


          {stitchStatus === 'completed' && finalVideoUrl && (
            <>
              <video controls src={finalVideoUrl} style={{ width: '100%', aspectRatio: previewAspectRatio, borderRadius: 'var(--r-md)', marginBottom: '12px', background: '#000', display: 'block', objectFit: 'contain' }} />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button onClick={() => handleDownload(finalVideoUrl, `final-ugc-${Date.now()}.mp4`)} className="btn btn-primary" style={{ flex: 1, fontSize: '13px' }}>
                  <Download style={{ width: 14, height: 14 }} />
                  Download Final Video
                </button>
                <button onClick={() => handleCopy(finalVideoUrl, 'final')} className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}>
                  <Copy style={{ width: 14, height: 14 }} />
                  {copied === 'final' ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
              <Link
                href={`/editor?videoUrl=${encodeURIComponent(finalVideoUrl)}&aspect=${components?.aspect === 'square' ? '1:1' : components?.aspect === 'landscape' ? '16:9' : '9:16'}`}
                className="btn btn-ghost"
                style={{ width: '100%', textAlign: 'center', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Film style={{ width: 14, height: 14 }} />
                Edit in Editor
              </Link>
            </>
          )}
        </div>
      )}

      {/* Scroll-stop hook: still assembling. Shown when the main clip is
          done but the hook clip or the stitch is still working. */}
      {hookClip && stitchStatus === 'idle' && video?.status === 'completed' && hookClip.status === 'processing' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            ✦ Assembling Scroll-Stop Hook
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '12px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
            <Loader style={{ width: 24, height: 24, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Assembling scroll-stop hook…</p>
            <p style={{ fontSize: '11px', color: 'var(--ink-fade)' }}>Main clip is ready. Stitching in the 1.5s opener.</p>
          </div>
        </div>
      )}
      {hookStitchStatus === 'stitching' && !finalVideoUrl && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            ✦ Stitching Final Video
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '12px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
            <Loader style={{ width: 24, height: 24, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Assembling scroll-stop hook…</p>
          </div>
        </div>
      )}

      {/* Render-in-progress card — shown while Kling is still working */}
      {video && video.status === 'processing' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: '12px' }}>
            ✦ Your Video
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '12px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
            <Loader style={{ width: 24, height: 24, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px', color: 'var(--ink-dim)' }}>Rendering your video…</p>
            <p style={{ fontSize: '11px', color: 'var(--ink-fade)' }}>Usually 2–4 minutes. This page auto-updates.</p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {video && video.status === 'failed' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--bad)', marginBottom: '12px' }}>
            Generation Failed
          </h3>
          {video.error ? (
            <p style={{ fontSize: '11px', color: 'var(--ink-fade)', fontFamily: 'var(--font-mono)', wordBreak: 'break-word', padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', lineHeight: 1.5 }}>
              {video.error}
            </p>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--ink-fade)' }}>No detail returned. Check your API keys or try again.</p>
          )}
        </div>
      )}
    </div>
  )
}
