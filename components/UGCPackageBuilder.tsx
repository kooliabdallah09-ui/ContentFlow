'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CharacterBuilder from '@/components/CharacterBuilder'
import { EMPTY_CHARACTER, type CharacterProfile } from '@/components/CharacterBuilder'
import { LANGUAGES, DEFAULT_LANGUAGE_CODE } from '@/lib/languages'
import { ASPECTS, DEFAULT_ASPECT, type UGCAspect } from '@/lib/aspects'
import {
  DEFAULT_TIER,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  calculateVideoCredits,
  estimateRenderSeconds,
  creditsToUSD,
  type UGCTier,
  type UGCDuration,
} from '@/lib/tiers'
import { getSupabase } from '@/lib/auth'
import { canAccessOmniFlashVideo, canAccessScrollStopHook } from '@/lib/pov-access'
import { SCROLL_STOP_HOOKS, isHookAllowedForFormat, type ScrollStopHook } from '@/lib/scroll-stop-hooks'
import { showError, showSuccess } from '@/lib/notifications'
import { readPrefill } from '@/lib/calendar-prefill'
import { readCampaignShotPrefill } from '@/lib/campaign-shot-prefill'
import { compressImageFile } from '@/lib/image-compress'
import { useImageDrop } from '@/hooks/useImageDrop'
import { ugcPackageCost, type UGCResolution } from '@/lib/ugc-pricing'
import { CAMPAIGN_FORMATS, type CampaignFormat } from '@/lib/campaign-formats'
import { BookOpen } from 'lucide-react'

interface HookVariant {
  id: string
  angle: string
  tone: string
  text: string
}

interface ShopifyProduct {
  id: number
  title: string
  handle: string
  body_html: string
  price: string
  images: string[]
}

interface UGCPackageBuilderProps {
  onGenerate: (settings: {
    ugcType: string
    tier: UGCTier
    duration: UGCDuration
    productName: string
    productDescription: string
    benefits: string
    callToAction: string
    style: string
    imageSize: string
    voiceId: string
    productImageBase64?: string
    productImageMimeType?: string
    selectedHook?: string
    character?: CharacterProfile
    customInstructions?: string
    language?: string
    aspect?: UGCAspect
    actorId?: string
    customPhotoBase64?: string
    customPhotoMimeType?: string
    productType?: 'physical' | 'website'
    prewrittenScript?: string
    // Scroll-stop hook v1 (admin-only). Populated when the user picks a hook —
    // the builder dispatches /api/ugc/scroll-stop-hook first and forwards the
    // returned Seedance jobId + frame url so the preview can poll & stitch.
    scrollStopHook?: {
      jobId: string
      frameUrl: string
      hookKey: string
      durationSec: number
      trimToSec?: number  // Target length after Shotstack trim. Defaults to 1.5.
    }
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

// The UGC builder always produces the full pipeline (script + Sora video +
// captions + B-rolls). For standalone images, users go to /generate/image
// from the sidebar — we don't conflate the two on this page anymore.
const UGC_TYPE = 'video-with-voiceover'

// Formats where the character is filming with a phone in-hand (POV /
// interview / vlog) — for these, the on-screen reference should be a
// MOBILE screenshot so the phone framing reads correctly. All other
// formats prefer a landing-page screenshot (laptop framing).
const POV_LIKE_FORMATS = new Set(['interview-pov', 'interview-man-on-street', 'pov-vlog', 'camera-pov'])

// Given a saved app product and the picked format, pick the best
// primary reference photo (the one that renders on the device screen)
// and return the remaining indices in original order for extras.
function pickPrimaryAppPhoto(
  product: { photo_urls: string[]; photo_angles?: (string | null)[] | null; product_type?: 'physical' | 'app' | null },
  formatKey: string | null,
): { url: string | null; angle: string; restIndices: number[] } {
  const urls = Array.isArray(product.photo_urls) ? product.photo_urls : []
  const angles = Array.isArray(product.photo_angles) ? product.photo_angles : []
  if (!urls.length) return { url: null, angle: '', restIndices: [] }
  const normAngles = urls.map((_, i) => String(angles[i] ?? '').toLowerCase().trim())
  const isApp = product.product_type === 'app'
  let primaryIdx = 0
  if (isApp) {
    const wantsMobile = formatKey && POV_LIKE_FORMATS.has(formatKey)
    const mobileIdx = normAngles.findIndex(a => a === 'mobile view' || a === 'mobile')
    const landingIdx = normAngles.findIndex(a => a === 'landing page')
    if (wantsMobile && mobileIdx >= 0) primaryIdx = mobileIdx
    else if (!wantsMobile && landingIdx >= 0) primaryIdx = landingIdx
    else if (landingIdx >= 0) primaryIdx = landingIdx
    else if (mobileIdx >= 0) primaryIdx = mobileIdx
  }
  const restIndices = urls.map((_, i) => i).filter(i => i !== primaryIdx)
  return {
    url: urls[primaryIdx] ?? null,
    angle: String(angles[primaryIdx] ?? ''),
    restIndices,
  }
}

// Voice is now generated natively by Kling v3 omni-video (one model produces
// video + voice in perfect sync). No voice picker needed — Kling chooses the
// voice based on the character's appearance from the hero frame.

export default function UGCPackageBuilder({ onGenerate, isLoading, creditBalance }: UGCPackageBuilderProps) {
  // Single tier now — voice is generated by Kling natively, so the Standard/Hero
  // distinction is gone. `tier` kept in state purely as a constant for the API contract.
  const tier: UGCTier = DEFAULT_TIER
  const router = useRouter()

  // ── Prefill sources (must be declared BEFORE any useState() that reads them —
  // useState invokes its lazy initializer synchronously, so referencing these
  // consts later would trip TDZ) ────────────────────────────────────────
  //
  // 1. Calendar / dashboard prefill — from the "Create now" hand-off.
  //    readPrefill deletes the sessionStorage key on read.
  const initialPrefill = (() => {
    if (typeof window === 'undefined') return null
    return readPrefill('ugc')
  })()

  // 2. Campaign shot prefill — from /campaigns/[id] → "Builder" deep link.
  //    Both sources coexist; the campaign one wins where fields overlap
  //    because it's more specific.
  const campaignShotPrefill = (() => {
    if (typeof window === 'undefined') return null
    return readCampaignShotPrefill()
  })()

  const [duration, setDuration] = useState<UGCDuration>(() => {
    const d = campaignShotPrefill?.duration
    if (typeof d === 'number' && [5, 10, 15, 20, 30].includes(d)) return d as UGCDuration
    // Nearest supported duration when the shot has an off-grid value (8, 12…).
    if (typeof d === 'number') {
      const supported: UGCDuration[] = [5, 10, 15, 20, 30]
      return supported.reduce((best, v) => Math.abs(v - d) < Math.abs(best - d) ? v : best, DEFAULT_DURATION)
    }
    return DEFAULT_DURATION
  })

  const [productName, setProductName] = useState(
    initialPrefill?.title ? initialPrefill.title.slice(0, 80) : '',
  )
  const [productDescription, setProductDescription] = useState(
    initialPrefill?.description ?? '',
  )
  const [benefits, setBenefits] = useState(
    campaignShotPrefill?.hook || initialPrefill?.reason || initialPrefill?.description || '',
  )
  const [callToAction, setCallToAction] = useState(campaignShotPrefill?.cta || 'Try it today')
  const [benefitsGenerating, setBenefitsGenerating] = useState(false)
  const [customInstructions, setCustomInstructions] = useState(() => {
    // Weave the full campaign shot brief into the director-style instructions.
    // Uses section headers + blank-line separators so the field renders
    // cleanly as a readable brief even if any single newline gets stripped
    // in transit.
    if (campaignShotPrefill) {
      const sections: string[] = []
      const fmtName = campaignShotPrefill.formatLabel || campaignShotPrefill.formatKey
      if (fmtName) sections.push(`FORMAT\n${fmtName}`)
      if (campaignShotPrefill.setting) sections.push(`SETTING\n${campaignShotPrefill.setting}`)
      if (campaignShotPrefill.visualNotes) sections.push(`VISUAL NOTES / BEATS\n${campaignShotPrefill.visualNotes}`)
      if (campaignShotPrefill.caption) sections.push(`ON-POST CAPTION\n${campaignShotPrefill.caption}`)
      if (sections.length) return sections.join('\n\n')
    }
    return initialPrefill?.description ?? ''
  })
  // Resolution — Seedance 2.0 supports 480p / 720p / 1080p / 4k. Different
  // per-second credit prices. Default 1080p.
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p' | '4k'>('1080p')
  // Seedance 2.0 (default, up to 4K) vs Seedance Mini (~half price, 720p cap).
  const [engine, setEngine] = useState<'seedance-2' | 'seedance-mini' | 'omni-flash'>('seedance-2')
  // Admin gate for the Omni Flash engine — hidden from non-admin users.
  const [showOmniFlash, setShowOmniFlash] = useState(false)
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE_CODE)
  const [aspect, setAspect] = useState<UGCAspect>(() => {
    const a = campaignShotPrefill?.aspect
    switch (a) {
      case '9:16': return 'portrait'
      case '4:5':  return 'tall45'
      case '1:1':  return 'square'
      case '16:9': return 'landscape'
      default: return DEFAULT_ASPECT
    }
  })
  const [character, setCharacter] = useState<CharacterProfile>(EMPTY_CHARACTER)
  // actorId / customPhoto retained as dead state slots for compatibility
  // with the parent onGenerate signature — always undefined now that the
  // actor library + custom-photo upload path have been removed.
  const actorId = undefined as string | undefined
  const customPhoto = undefined as { base64: string; mimeType: string } | undefined
  void actorId; void customPhoto
  const [productImage, setProductImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  // Additional photos of the SAME product (e.g. candy: sealed package +
  // the candies inside). Up to 2. Sent alongside productImage everywhere.
  const [extraProductImages, setExtraProductImages] = useState<Array<{ base64: string; mimeType: string; preview: string; angle?: string }>>([])
  // Angle label for the primary product image, when we know it (imported
  // from a Product Studio saved product). Empty string for uploads. Sent
  // alongside extras' angles as `productPhotoAngles` so Nano Banana knows
  // which UI screen each reference is (landing page / mobile / dashboard).
  const [primaryPhotoAngle, setPrimaryPhotoAngle] = useState<string>('')
  // Optional packaging reference (shipping/retail box) for unboxing-style
  // formats. Kept separate from extraProductImages so the UI can label it
  // explicitly; merged into extraProductImages on submit so the routes see
  // it as another product reference photo.
  const [packagingImage, setPackagingImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  // Product type toggle — physical (default) uses the normal file-upload
  // path; 'website' swaps the upload for a URL input that fetches a landing-
  // page screenshot via /api/screenshot and drops it into productImage so
  // downstream pipeline sees it as a normal reference image.
  const [productType, setProductType] = useState<'physical' | 'website'>('physical')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websiteFetching, setWebsiteFetching] = useState(false)
  const [websiteError, setWebsiteError] = useState<string | null>(null)

  // Shopify product picker
  const [shopifyUrl, setShopifyUrl] = useState('')
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[] | null>(null)
  const [shopifyLoading, setShopifyLoading] = useState(false)
  const [shopifyError, setShopifyError] = useState<string | null>(null)
  const [selectedShopifyProduct, setSelectedShopifyProduct] = useState<ShopifyProduct | null>(null)

  // Brand profile — loaded once on mount. When the user toggles `useBrand` on,
  // we pre-fill the 4 product fields + product image from this profile (and lock
  // them with a visual cue). Toggling off restores manual entry.
  //
  // For brands with multiple products (t-shirt brand etc.), the brand profile
  // also exposes a `products` catalog. When useBrand is on and there are 2+
  // products, the picker below lets the user choose which one to advertise.
  // The picked product's image becomes the Nano Banana / Sora reference.
  interface BrandProfile {
    productName: string
    description: string
    keyBenefits: string
    defaultCta: string
    productImageUrl?: string
  }
  interface BrandProduct { id: string; name: string; image_url: string | null }
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [products, setProducts] = useState<BrandProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(campaignShotPrefill?.productId ?? null)
  const [useBrand, setUseBrand] = useState(false)

  // Hero-frame picker (new intermediate step between script review and
  // Kling video submission). frames[] is populated by /api/ugc/hero-frames;
  // when the user clicks one, we call /api/ugc/animate with that URL as the
  // Kling start_image.
  const [frames, setFrames] = useState<string[] | null>(null)
  const [framesLoading, setFramesLoading] = useState(false)
  const [savedFramesToGallery, setSavedFramesToGallery] = useState(false)
  const [animating, setAnimating] = useState(false)
  // Which frame the user clicked — drives the picked highlight + overlay.
  const [pickedFrameUrl, setPickedFrameUrl] = useState<string | null>(null)
  // Staged status messages while the animate pipeline runs (~60-90s of
  // gridify + validation + Sonnet directing + Seedance submission). Without
  // this the screen looks frozen after the click.
  const [animateStageIdx, setAnimateStageIdx] = useState(0)
  const ANIMATE_STAGES = [
    'Preparing your frame…',
    'Applying the privacy grid…',
    'Validating the character stays readable…',
    'Directing the scenes + writing camera notes…',
    'Attaching your product reference…',
    'Submitting to the video engine…',
    'Almost there — finalizing the render job…',
  ]
  useEffect(() => {
    if (!animating) { setAnimateStageIdx(0); return }
    const t = setInterval(() => {
      setAnimateStageIdx(i => Math.min(i + 1, ANIMATE_STAGES.length - 1))
    }, 12000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating])

  // Admin gate for Omni Flash — loaded once on mount from the session.
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    supabase.auth.getSession().then((res: { data: { session: { user?: { email?: string | null } } | null } }) => {
      const email = res.data.session?.user?.email ?? null
      setShowOmniFlash(canAccessOmniFlashVideo(email))
      setIsAdminUser(canAccessScrollStopHook(email))
    })
  }, [])

  // Character prompts + saved actors state
  const [characterImagePrompt, setCharacterImagePrompt] = useState<string>('')
  const [characterIdea, setCharacterIdea] = useState<string>('')
  const [savedActorId, setSavedActorId] = useState<string | undefined>(undefined)
  interface SavedActor {
    id: string
    name: string
    hero_frame_url: string
    character_idea: string | null
    last_used_at: string
  }
  const [savedActors, setSavedActors] = useState<SavedActor[]>([])
  const [saveActorName, setSaveActorName] = useState('')
  const [savingActor, setSavingActor] = useState(false)

  // Influencer Studio characters (admin-gated feature — the fetch 401s for
  // everyone else and the section simply doesn't render).
  interface InfluencerCard {
    id: string
    name: string
    handle?: string | null
    niche?: string | null
    portrait_url: string
  }
  const [influencers, setInfluencers] = useState<InfluencerCard[]>([])
  // Product Studio products — importable into this form with all angles.
  const [studioProducts, setStudioProducts] = useState<Array<{ id: string; name: string; description?: string | null; photo_urls: string[]; photo_angles?: (string | null)[]; product_type?: 'physical' | 'app'; website_url?: string | null }>>([])
  const [studioProductId, setStudioProductId] = useState<string | undefined>(undefined)
  // Scene Studio scenes — the environment the UGC happens in. Feeds Sonnet
  // the location brief and feeds NB a hero anchor image so the shots render
  // inside a real, consistent place instead of a generic AI room.
  const [scenes, setScenes] = useState<Array<{ id: string; name: string; scene_prompt: string; hero_image_url: string | null }>>([])
  const [sceneId, setSceneId] = useState<string | undefined>(campaignShotPrefill?.sceneId)
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | undefined>(campaignShotPrefill?.actorId)
  const [bridgingInfluencer, setBridgingInfluencer] = useState(false)
  // Gallery of the selected influencer: portrait + photoshoot photos. The
  // user either lets the AI use the gallery as identity references
  // (default) or hand-picks one photo as THE reference.
  const [influencerGallery, setInfluencerGallery] = useState<Array<{ id: string; image_url: string; scene?: string }>>([])
  const [influencerPhotoUrl, setInfluencerPhotoUrl] = useState<string | undefined>(undefined)

  // Progressive-reveal state. unlockedStep starts at 1 for cold visits; each
  // section 2-5 fades in when it becomes ≤ unlockedStep. Step 1 auto-advances
  // once the user has interacted with both Duration and Aspect. Steps 2-4
  // unlock via a Continue button at the bottom of each.
  //
  // When the user arrives from the dashboard/calendar with a prefill, we
  // skip the whole reveal animation — every section is unlocked on first
  // paint. Same for the "touched" flags so the highlighted-active look is
  // applied to the default duration + aspect immediately.
  // With the collapsible-step redesign every section renders from the start;
  // the collapse system controls what's visible instead of progressive gates.
  const initiallyUnlocked = 5
  const [unlockedStep, setUnlockedStep] = useState(initiallyUnlocked)
  // Product step: hide the rare fields (Shopify import, Key benefits, CTA)
  // behind a single 'More details' toggle so the default view is just
  // name + description + photo.
  const [showProductAdvanced, setShowProductAdvanced] = useState(false)
  // Format pills always visible — quick cycle-to-switch controls.
  const [showFormatPills, setShowFormatPills] = useState(true)
  // Admin-only: show USD equivalent next to every credit amount.
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data } = await supabase.auth.getSession()
      const email = data?.session?.user?.email?.toLowerCase() ?? ''
      setIsAdmin(email === 'abdallah.kooli@icloud.com' || email === 'abdallah@icloud.com')
    })()
  }, [])
  const [durationTouched, setDurationTouched] = useState(!!initialPrefill)
  const [aspectTouched, setAspectTouched] = useState(!!initialPrefill)
  const step1Ref = useRef<HTMLElement | null>(null)
  // Collapse state for the numbered step sections. Clicking a summary card
  // above or a section header toggles which one is open at a time.
  const [openStep, setOpenStep] = useState<1 | 2 | 3 | 4 | null>(1)
  function toggleStep(n: 1 | 2 | 3 | 4, ref: React.RefObject<HTMLElement | null>) {
    setOpenStep(prev => (prev === n ? null : n))
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const step2Ref = useRef<HTMLElement | null>(null)
  const step3Ref = useRef<HTMLElement | null>(null)
  const step4Ref = useRef<HTMLElement | null>(null)
  const step5Ref = useRef<HTMLElement | null>(null)
  // Scroll-stop hook (admin) — dispatch result held here between handleSubmit
  // (which fires the hook render in parallel) and runAnimate (which forwards
  // it through onGenerate so the preview can poll + stitch).
  const scrollStopHookRef = useRef<{ jobId: string; frameUrl: string; hookKey: string; durationSec: number } | null>(null)

  useEffect(() => {
    if (durationTouched && aspectTouched && unlockedStep < 2) {
      setUnlockedStep(2)
      // Wait one paint so the newly-mounted section exists in the DOM.
      requestAnimationFrame(() => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }, [durationTouched, aspectTouched, unlockedStep])

  function advanceTo(n: number, ref: React.RefObject<HTMLElement | null>) {
    setUnlockedStep(prev => Math.max(prev, n))
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // Format Library modal — inline picker replacing the standalone /formats page.
  // On pick, we prefill duration + aspect + direction + benefits so the form
  // reflects the chosen format's spec instantly.
  const [showFormatPicker, setShowFormatPicker] = useState(false)
  const [activeFormatKey, setActiveFormatKey] = useState<string | null>(null)
  // Scroll-stop hook (admin-only v1). When enabled + a hook is picked, we
  // fire /api/ugc/scroll-stop-hook in parallel with the main video flow
  // and hand the returned jobId + frameUrl to the preview for stitching.
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [hookEnabled, setHookEnabled] = useState(false)
  const [selectedHookKey, setSelectedHookKey] = useState<string | null>(null)
  const [showHookPicker, setShowHookPicker] = useState(false)
  // Two-person co-star: null = auto-generate PERSON B. Set to another
  // saved influencer's id to have them co-star. Only meaningful when
  // the active format's pipeline is ugc-interview or ugc-couple.
  const [secondInfluencerId, setSecondInfluencerId] = useState<string | null>(null)
  const [showSecondPicker, setShowSecondPicker] = useState(false)
  // Explicit opt-in for the auto-generated second character. When the user
  // is on a solo (non-interview/couple) format we still let them add a co-
  // star — either by picking one from Influencers OR by ticking this flag
  // to let the AI invent PERSON B. Either signal routes to the two-person
  // pipeline for both frames AND script.
  const [useAutoSecondChar, setUseAutoSecondChar] = useState(false)
  const activeFormat = activeFormatKey ? CAMPAIGN_FORMATS.find(f => f.key === activeFormatKey) ?? null : null
  // Formats where a "what's inside the box" reveal is core — for these we
  // expose an optional packaging photo upload so Nano Banana has a real
  // box to render instead of inventing one (or worse, framing the bare
  // product as though it were the box).
  const wantsPackagingPhoto = ['unboxing', 'unboxing-asmr', 'mystery-box'].includes(activeFormatKey ?? '')
  // Merged payload for API calls — packaging photo is sent as another
  // product reference so the routes can treat it uniformly.
  const combinedExtraProductImages = (packagingImage
    ? [packagingImage, ...extraProductImages]
    : extraProductImages
  ).slice(0, 2)
  // Angles parallel to the reference stack the routes see: [primary, ...extras].
  // Packaging image (when present) has no angle — treat as empty string.
  const combinedExtraAngles = combinedExtraProductImages.map(img => (img as { angle?: string }).angle ?? '')
  const productPhotoAngles = [primaryPhotoAngle, ...combinedExtraAngles]
  const isTwoPersonFormat = !!activeFormat && (activeFormat.pipeline === 'ugc-interview' || activeFormat.pipeline === 'ugc-couple')
  // True whenever the user has opted-in to a second character — either by
  // picking one, ticking auto-generate, or being on a two-person format
  // (which implicitly needs two people). Drives BOTH the frame endpoint
  // choice and the script's two-person dialogue mode.
  const hasSecondCharacter = !!secondInfluencerId || useAutoSecondChar || isTwoPersonFormat
  // Motion-broll formats are product-first, no character, no dialogue.
  // They skip script generation entirely and route to /api/ugc/motion-broll-*
  // for both frames and animate.
  const isMotionBrollFormat = !!activeFormat && activeFormat.pipeline === 'motion-broll'
  // Visual transformation formats (before-after, mess-to-fresh) — actor present
  // but no spoken dialogue. Skip the script review step; pass a minimal visual
  // context script to the animate API so it builds a silent transformation video.
  const isNoScriptFormat = !!activeFormat?.noScript
  // Photo formats never belong in the video builder — belt-and-suspenders
  // guard in case a photo format survives into builder state.
  const isPhotoFormat = !!activeFormat && (
    activeFormat.pipeline === 'hero-editorial' ||
    activeFormat.pipeline === 'lifestyle-photo' ||
    activeFormat.pipeline === 'product-photo'
  )
  const secondCharacterRoleLabel = activeFormat?.pipeline === 'ugc-interview'
    ? 'Auto-generated stranger'
    : activeFormatKey === 'couple-sharing'
      ? 'Auto-generated partner'
      : activeFormatKey === 'roommate-rec'
        ? 'Auto-generated roommate'
        : 'Auto-generated co-star'
  function applyFormat(fmt: CampaignFormat) {
    // Photo formats live in Product Studio, not the video builder.
    // Redirect with prefill query so Product Studio can pre-select the right
    // aesthetic sub-style and drop the product name/description into the form.
    const photoPipelines = ['hero-editorial', 'lifestyle-photo', 'product-photo'] as const
    if ((photoPipelines as readonly string[]).includes(fmt.pipeline)) {
      const substyle =
        fmt.pipeline === 'hero-editorial' ? 'editorial' :
        fmt.pipeline === 'lifestyle-photo' ? 'lifestyle' : 'studio'
      const params = new URLSearchParams({
        formatKey: fmt.key,
        mode: 'aesthetic',
        substyle,
      })
      if (productName.trim()) params.set('productName', productName.trim())
      if (productDescription.trim()) params.set('productDescription', productDescription.trim())
      setShowFormatPicker(false)
      showSuccess('Photo format — opening Product Studio…', fmt.label)
      router.push(`/generate/products?${params.toString()}`)
      return
    }
    // Snap duration to nearest supported UGCDuration.
    const supported: UGCDuration[] = [5, 10, 15, 20, 30]
    const d = fmt.defaultDuration || 15
    const snapped = supported.reduce((best, v) => Math.abs(v - d) < Math.abs(best - d) ? v : best, DEFAULT_DURATION)
    setDuration(snapped)
    setDurationTouched(true)
    // Map aspect string → UGCAspect.
    const a: UGCAspect =
      fmt.defaultAspect === '9:16' ? 'portrait' :
      fmt.defaultAspect === '4:5'  ? 'tall45' :
      fmt.defaultAspect === '1:1'  ? 'square' : 'landscape'
    setAspect(a)
    setAspectTouched(true)
    // Don't touch customInstructions — that's reserved for the user's
    // optional extras. The format's shot direction reaches the server via
    // activeFormatKey and is injected there. Also strip any stale
    // "Format: ..." block a previous version of this code may have left in
    // the textarea so switching formats doesn't accumulate old briefs.
    setCustomInstructions(prev => prev.replace(/^Format:[\s\S]*?(?:\n\n|$)/, '').trimStart())
    setActiveFormatKey(fmt.key)
    setShowFormatPicker(false)
    showSuccess(`Format applied: ${fmt.label}`, `Duration + aspect updated.`)
  }

  // Three-step flow: form → script review → hero frame pick → video
  const [step, setStep] = useState<'form' | 'script' | 'frames'>('form')
  const [generatedScript, setGeneratedScript] = useState<string>(campaignShotPrefill?.script ?? '')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [editedScript, setEditedScript] = useState<string>(campaignShotPrefill?.script ?? '')
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [reviseInput, setReviseInput] = useState('')
  const [revising, setRevising] = useState(false)

  // Hook-preview stage
  const [hooks, setHooks] = useState<HookVariant[] | null>(null)
  const [hooksLoading, setHooksLoading] = useState(false)
  const [hooksError, setHooksError] = useState<string | null>(null)

  // Fetch a saved brand image URL, convert to base64, and shove it into the
  // productImage state so the existing orchestrate pipeline reads it like a
  // freshly-uploaded file. Used when the brand toggle flips ON.
  async function loadBrandImage(url: string) {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const blob = await res.blob()
      const buf = await blob.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      const base64 = btoa(bin)
      const mimeType = blob.type || 'image/png'
      return {
        base64,
        mimeType,
        preview: `data:${mimeType};base64,${base64}`,
      }
    } catch {
      return null
    }
  }

  // Load the user's brand profile + product catalog once. If they have a
  // meaningful brand (name present), default useBrand to ON. If multiple
  // products exist, default to the first one.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) return
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (!token) return

        const [brandRes, productsRes, actorsRes, influencersRes] = await Promise.all([
          fetch('/api/brand/load', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/brand/products', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/ugc/saved-actors', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/influencers', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        try {
          const spRes = await fetch('/api/products-studio', { headers: { Authorization: `Bearer ${token}` } })
          if (spRes.ok) {
            const spData = await spRes.json()
            if (!cancelled && Array.isArray(spData?.products)) setStudioProducts(spData.products)
          }
        } catch { /* best-effort */ }
        try {
          const scRes = await fetch('/api/scenes', { headers: { Authorization: `Bearer ${token}` } })
          if (scRes.ok) {
            const scData = await scRes.json()
            if (!cancelled && Array.isArray(scData?.scenes)) setScenes(scData.scenes)
          }
        } catch { /* best-effort */ }
        try {
          const actorsData = await actorsRes.json()
          if (!cancelled && Array.isArray(actorsData?.actors)) setSavedActors(actorsData.actors)
        } catch { /* actors load is best-effort */ }
        try {
          // 401 for non-admin accounts — the section just won't render.
          if (influencersRes.ok) {
            const infData = await influencersRes.json()
            if (!cancelled && Array.isArray(infData?.influencers)) setInfluencers(infData.influencers)
          }
        } catch { /* influencers load is best-effort */ }
        const brandData = await brandRes.json()
        const productsData = await productsRes.json()
        if (cancelled) return

        const list: BrandProduct[] = Array.isArray(productsData?.products) ? productsData.products : []
        setProducts(list)

        const p = brandData?.profile
        if (!p?.company_name) return

        const profile: BrandProfile = {
          productName: p.company_name ?? '',
          description: p.description ?? '',
          keyBenefits: p.unique_value_prop ?? '',
          defaultCta: p.brand_mission ?? 'Try it today',
          productImageUrl: p.logo_url ?? undefined,
        }
        setBrand(profile)
        setUseBrand(true)
        // Brand text fields. Note: productName here is actually the BRAND name
        // (we share the same column). When a specific product is picked below
        // we override productName with that product's name.
        setProductDescription(profile.description)
        setBenefits(profile.keyBenefits)
        setCallToAction(profile.defaultCta)

        // Pick the first catalog product as the default. Its image becomes the
        // first-frame seed; its name overrides the brand name in the form.
        const first = list[0]
        if (first) {
          setSelectedProductId(first.id)
          setProductName(first.name)
          if (first.image_url) {
            loadBrandImage(first.image_url).then(img => {
              if (!cancelled && img) setProductImage(img)
            })
          }
        } else {
          // No catalog yet — fall back to the legacy single image + brand name.
          setProductName(profile.productName)
          if (profile.productImageUrl) {
            loadBrandImage(profile.productImageUrl).then(img => {
              if (!cancelled && img) setProductImage(img)
            })
          }
        }
      } catch {
        // brand load is non-critical — silent failure is fine
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Pick a product from the catalog — swaps the product name + first-frame image.
  async function pickProduct(id: string) {
    const p = products.find(x => x.id === id)
    if (!p) return
    setSelectedProductId(id)
    setProductName(p.name)
    if (p.image_url) {
      const img = await loadBrandImage(p.image_url)
      if (img) setProductImage(img)
    }
  }

  // When the user flips the toggle, sync the form fields accordingly.
  async function toggleUseBrand(next: boolean) {
    setUseBrand(next)
    if (next && brand) {
      setProductName(brand.productName)
      setProductDescription(brand.description)
      setBenefits(brand.keyBenefits)
      setCallToAction(brand.defaultCta)
      if (brand.productImageUrl) {
        const img = await loadBrandImage(brand.productImageUrl)
        if (img) setProductImage(img)
      }
    } else if (!next) {
      setProductName('')
      setProductDescription('')
      setBenefits('')
      setCallToAction('Try it today')
      setProductImage(null)
    }
  }

  // UGC always renders the full pipeline. Single tier now (Kling v3 omni handles voice natively).
  const includesVideo = true
  // Full package cost — Seedance rate at the chosen resolution + fixed
  // Nano Banana Pro / Claude overhead. Shared source of truth in
  // lib/ugc-pricing so the client display never drifts from the server
  // deduction.
  // Crush-Test multi-shot: when duration >8s the pipeline splits into
  // 2-4 shots (per planCrushTestShots), each rendered as a separate
  // Seedance job. Cost = sum of per-shot single-shot costs.
  const isCrushTestMultiShot = activeFormatKey === 'crush-test' && duration > 8
  const crushShotCount = duration <= 8 ? 1 : duration <= 15 ? 2 : duration <= 24 ? 3 : 4
  const crushShotDurations: number[] = (() => {
    if (!isCrushTestMultiShot) return [duration]
    const base = Math.floor(duration / crushShotCount)
    const remainder = duration - base * crushShotCount
    return Array.from({ length: crushShotCount }, (_, i) => Math.max(3, Math.min(10, base + (i < remainder ? 1 : 0))))
  })()
  const videoCredits = isCrushTestMultiShot
    ? crushShotDurations.reduce((sum, d) => sum + ugcPackageCost(d, resolution, engine), 0)
    : ugcPackageCost(duration, resolution, engine)
  // Scroll-stop hook adds a fixed ~120cr surcharge (see the API route).
  const SCROLL_STOP_HOOK_COST_CR = 120
  const hookCredits = (isAdminUser && hookEnabled && selectedHookKey) ? SCROLL_STOP_HOOK_COST_CR : 0
  const totalCredits = videoCredits + hookCredits
  void calculateVideoCredits
  // Require a picked creator (either a saved influencer or a saved actor)
  // to hit Generate — no more AI-picked characters.
  // Motion-broll is product-only — no creator required. All other pipelines
  // still require either a saved influencer or actor.
  const hasCreator = isMotionBrollFormat ? true : !!(selectedInfluencerId || savedActorId)
  const canGenerate = !scriptLoading && productName.trim() && productDescription.trim() && hasCreator

  // Downscale + re-encode uploaded product photos before storing them in
  // state. Raw phone-camera JPEGs are 5-15 MB — over Vercel's 4.5 MB
  // request-body limit for the downstream generate calls. Shared helper
  // in @/lib/image-compress caps to 1600px long edge at JPEG q0.85, which
  // almost always lands under 600 KB.
  // Shared handler so file-picker and drag-drop paths compress + set state the same way.
  const acceptProductImage = async (file: File) => {
    try {
      const compressed = await compressImageFile(file)
      setProductImage(compressed)
      setPrimaryPhotoAngle('')
    } catch (err) {
      console.warn('[UGCPackageBuilder] product image compress fallback:', err)
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1] ?? ''
        setProductImage({ base64, mimeType: file.type, preview: dataUrl })
      }
      reader.readAsDataURL(file)
    }
  }
  const productDrop = useImageDrop({
    multiple: false,
    onFiles: files => acceptProductImage(files[0]),
    disabled: isLoading,
  })
  const extraProductDrop = useImageDrop({
    onFiles: async files => {
      for (const f of files.slice(0, 2 - extraProductImages.length)) {
        try {
          const compressed = await compressImageFile(f)
          setExtraProductImages(prev => prev.length < 2 ? [...prev, compressed] : prev)
        } catch { showError('Image failed', `Could not read ${f.name}`) }
      }
    },
    disabled: isLoading || extraProductImages.length >= 2,
  })
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await acceptProductImage(file)
  }

  const resetForm = () => {
    setProductName('')
    setProductDescription('')
    setBenefits('')
  }

  // Kick off hero-frame generation. Once we have 4 frames, move to the
  // 'frames' step so the user can pick one.
  const requestHeroFrames = async (finalScript: string) => {
    setFramesLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      // Two-person formats (interview / couple / roommate) route to the
      // dedicated composer that stages TWO characters in one Nano Banana
      // Pro frame. Everything else stays on the solo hero-frames path.
      // Two-person pipeline fires whenever a co-star is on deck — regardless
      // of the picked format. Two-person format still forces it on for
      // interview/couple even without an explicit co-star pick.
      const useTwoPerson = !!selectedInfluencerId && hasSecondCharacter
      const useMotionBroll = isMotionBrollFormat
      const endpoint = useMotionBroll
        ? '/api/ugc/motion-broll-frames'
        : useTwoPerson ? '/api/ugc/two-person-frames' : '/api/ugc/hero-frames'
      const payload: Record<string, unknown> = useMotionBroll
        ? {
            productName,
            productDescription,
            productImageBase64: productImage?.base64,
            productImageMimeType: productImage?.mimeType,
            extraProductImages: combinedExtraProductImages.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
            productPhotoAngles,
            aspectId: aspect,
            formatKey: activeFormatKey,
            videoDirection: customInstructions.trim() || undefined,
            sceneId,
          }
        : useTwoPerson
        ? {
            productName,
            productDescription,
            productImageBase64: productImage?.base64,
            productImageMimeType: productImage?.mimeType,
            aspectId: aspect,
            videoDirection: customInstructions.trim() || undefined,
            script: finalScript,
            influencerId: selectedInfluencerId,
            secondInfluencerId: secondInfluencerId ?? undefined,
            sceneId,
            formatKey: activeFormatKey,
            productType,
            productPhotoAngles,
          }
        : {
            productName,
            productDescription,
            productImageBase64: productImage?.base64,
            productImageMimeType: productImage?.mimeType,
            productType,
            character,
            avatarGender: character?.gender ?? 'Female',
            aspectId: aspect,
            videoDirection: customInstructions.trim() || undefined,
            script: finalScript,
            savedActorId,
            influencerId: selectedInfluencerId,
            influencerPhotoUrl,
            sceneId,
            extraProductImages: combinedExtraProductImages.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
            productPhotoAngles,
            formatKey: activeFormatKey,
          }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to render hero frames')
      setFrames(data.frames)
      setSavedFramesToGallery(false)
      // Cache the character prompts returned by /api/ugc/hero-frames so
      // the user can save this identity as a reusable actor after picking.
      setCharacterImagePrompt(String(data.characterImagePrompt ?? ''))
      setCharacterIdea(String(data.characterIdea ?? ''))
      setStep('frames')
    } catch (err) {
      showError('Frames failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setFramesLoading(false)
    }
  }

  // Called once the user has picked one of the 4 hero frames.
  const runCrushTestMultiShot = async () => {
    setAnimating(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/ugc/motion-broll-multishot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          formatKey: 'crush-test',
          productName,
          productDescription,
          videoDirection: customInstructions.trim() || undefined,
          aspect,
          resolution,
          engine,
          duration,
          productImageBase64: productImage?.base64,
          productImageMimeType: productImage?.mimeType,
          extraProductImages: combinedExtraProductImages.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Crush-test multishot submission failed')

      await onGenerate({
        ugcType: UGC_TYPE, tier, duration, productName, productDescription, benefits, callToAction,
        style: 'realistic', imageSize: '1024x1024', voiceId: '',
        productImageBase64: productImage?.base64,
        productImageMimeType: productImage?.mimeType,
        character,
        customInstructions: customInstructions.trim() || undefined,
        language,
        aspect,
        actorId,
        customPhotoBase64: customPhoto?.base64,
        customPhotoMimeType: customPhoto?.mimeType,
        productType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        __animateResponse: data as any,
      } as Parameters<typeof onGenerate>[0])

      setStep('form')
      setGeneratedScript('')
      setEditedScript('')
      setFrames(null)
      resetForm()
    } catch (err) {
      showError('Crush-test multishot failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setAnimating(false)
    }
  }

  const runAnimate = async (selectedFrameUrl: string, finalScript: string) => {
    setAnimating(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      // Fire-and-forget: if the user typed a nickname, save this pick as a
      // reusable actor before we ship them off to the animate stage.
      const trimmedName = saveActorName.trim()
      if (trimmedName && characterImagePrompt && !savedActorId) {
        setSavingActor(true)
        try {
          const saveRes = await fetch('/api/ugc/saved-actors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              name: trimmedName,
              heroFrameUrl: selectedFrameUrl,
              characterImagePrompt,
              characterIdea,
              personaLocks: character ?? {},
            }),
          })
          if (saveRes.ok) {
            const saveData = await saveRes.json()
            if (saveData?.actor) {
              setSavedActors(prev => [saveData.actor, ...prev])
              showSuccess('Actor saved', `${trimmedName} is now reusable.`)
            }
          }
        } catch { /* non-blocking */ }
        setSavingActor(false)
      }

      const animateEndpoint = isMotionBrollFormat ? '/api/ugc/motion-broll-animate' : '/api/ugc/animate'
      const animatePayload: Record<string, unknown> = isMotionBrollFormat
        ? {
            frameUrl: selectedFrameUrl,
            selectedFrameUrl,
            formatKey: activeFormatKey,
            productName,
            productDescription,
            videoDirection: customInstructions.trim() || undefined,
            aspect,
            resolution,
            engine,
            duration,
            productImageBase64: productImage?.base64,
            productImageMimeType: productImage?.mimeType,
          }
        : {
            selectedFrameUrl,
            script: finalScript,
            ugcType: UGC_TYPE,
            duration,
            productName,
            productDescription,
            benefits,
            callToAction,
            avatarGender: character?.gender ?? 'Female',
            character,
            customInstructions: customInstructions.trim() || undefined,
            language,
            aspect,
            // Product photo, forwarded so the animate route can run pass-2
            // Nano Banana refinement against the user-picked frame. Server
            // fails soft — if refinement errors we keep the raw frame.
            productImageBase64: productImage?.base64,
            productImageMimeType: productImage?.mimeType,
            extraProductImages: combinedExtraProductImages.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
            resolution,
            engine,
            // videoDirection is the freeform "how should this ad feel"
            // note the Seedance prompt builder ingests. Reuse the existing
            // Custom Instructions textarea for this — same intent.
            videoDirection: customInstructions.trim() || undefined,
          }
      const res = await fetch(animateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(animatePayload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Seedance submission failed')

      // Delegate to the parent's onGenerate. We pass a special sentinel
      // (`__animateResponse`) so the parent knows the pipeline already ran
      // and it just needs to wire the response into UI state.
      await onGenerate({
        ugcType: UGC_TYPE, tier, duration, productName, productDescription, benefits, callToAction,
        style: 'realistic', imageSize: '1024x1024', voiceId: '',
        productImageBase64: productImage?.base64,
        productImageMimeType: productImage?.mimeType,
        character,
        customInstructions: customInstructions.trim() || undefined,
        language,
        aspect,
        actorId,
        customPhotoBase64: customPhoto?.base64,
        customPhotoMimeType: customPhoto?.mimeType,
        productType,
        scrollStopHook: scrollStopHookRef.current
          ? { ...scrollStopHookRef.current, trimToSec: 1.5 }
          : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        __animateResponse: data as any,
      } as Parameters<typeof onGenerate>[0])

      // Reset flow state
      setStep('form')
      setGeneratedScript('')
      setEditedScript('')
      setFrames(null)
      resetForm()
    } catch (err) {
      showError('Animate failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setAnimating(false)
    }
  }

  const runGenerate = async (selectedHook?: string, prewrittenScript?: string) => {
    // The old direct-to-Kling path. Now we route through hero-frames first —
    // final script is either the pre-written one, the edited one, or the AI
    // draft. selectedHook is folded in earlier where we build editedScript.
    void selectedHook
    const finalScript = (editedScript || prewrittenScript || generatedScript || '').trim()
    if (!finalScript) {
      showError('No script', 'Generate or paste a script first')
      return
    }
    await requestHeroFrames(finalScript)
  }

  async function fetchShopifyProducts() {
    if (!shopifyUrl.trim()) return
    setShopifyLoading(true)
    setShopifyError(null)
    setShopifyProducts(null)
    setSelectedShopifyProduct(null)
    try {
      const res = await fetch(`/api/shopify/products?store=${encodeURIComponent(shopifyUrl.trim())}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShopifyProducts(data.products)
    } catch (e) {
      setShopifyError(e instanceof Error ? e.message : 'Failed to fetch products')
    } finally {
      setShopifyLoading(false)
    }
  }

  async function applyShopifyProduct(product: ShopifyProduct) {
    setSelectedShopifyProduct(product)
    setProductName(product.title)

    // Strip HTML tags for description
    const desc = product.body_html.replace(/<[^>]+>/g, '').trim().slice(0, 400)
    setProductDescription(desc)

    // Try to extract <li> items as benefits first (instant, no API call)
    const liMatches = [...product.body_html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    if (liMatches.length > 0) {
      const bullets = liMatches
        .slice(0, 5)
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
      setBenefits(bullets.join(' · '))
      setCallToAction(`Shop ${product.title}`)
    } else {
      // No bullet points in HTML — generate benefits + CTA with Claude
      setBenefits('')
      setBenefitsGenerating(true)
      try {
        const supabase = getSupabase()
        const { data } = await supabase!.auth.getSession()
        const token = data.session?.access_token
        if (token) {
          const res = await fetch('/api/shopify/benefits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productName: product.title, productDescription: desc, price: product.price }),
          })
          if (res.ok) {
            const generated = await res.json()
            setBenefits(generated.benefits ?? '')
            setCallToAction(generated.callToAction ?? `Shop ${product.title}`)
          } else {
            setCallToAction(`Shop ${product.title}`)
          }
        }
      } catch {
        setCallToAction(`Shop ${product.title}`)
      } finally {
        setBenefitsGenerating(false)
      }
    }

    // Load first image as product image
    if (product.images[0]) {
      fetch(product.images[0])
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const [meta, base64] = dataUrl.split(',')
            const mimeType = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
            setProductImage({ base64, mimeType, preview: product.images[0] })
          }
          reader.readAsDataURL(blob)
        })
        .catch(() => {/* image load failed, skip */})
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading || scriptLoading) return

    // Scroll-stop hook v1 — admin-only. Fire in PARALLEL with the main
    // video flow so it doesn't block the primary generate path. The hook
    // clip will be polled + stitched by the preview once the API returns
    // its jobId and frameUrl. Silent-fail: if the hook API errors we just
    // proceed with the main clip.
    scrollStopHookRef.current = null
    if (isAdminUser && hookEnabled && selectedHookKey && !isMotionBrollFormat && !isNoScriptFormat) {
      const povIncompatible = ['interview-pov', 'interview-man-on-street', 'pov-vlog', 'camera-pov'].includes(activeFormatKey ?? '')
      if (!povIncompatible) {
        ;(async () => {
          try {
            const supabase = getSupabase()
            if (!supabase) return
            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            if (!token) return
            const res = await fetch('/api/ugc/scroll-stop-hook', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                hookKey: selectedHookKey,
                influencerId: selectedInfluencerId ?? undefined,
                productImageBase64: productImage?.base64,
                productImageMimeType: productImage?.mimeType,
                extraProductImages: combinedExtraProductImages,
                aspectId: aspect,
                formatKey: activeFormatKey,
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              console.warn('[scroll-stop-hook] dispatch failed:', data?.error)
              return
            }
            // Stash the returned ids on window so a future stitch integration
            // in the preview can pick them up without needing to plumb them
            // through the parent onGenerate contract. This is intentional
            // scaffolding for v1 — the full stitch wiring lives here for
            // now and will be lifted into UGCPackagePreview once the design
            // review of the client-side polling flow lands.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window as any).__scrollStopHook = { jobId: data.jobId, frameUrl: data.frameUrl, hookKey: data.hookKey, durationSec: data.durationSec }
            // Also stash on a ref so runAnimate can forward it through the
            // parent onGenerate contract into UGCPackagePreview.
            scrollStopHookRef.current = {
              jobId: data.jobId,
              frameUrl: data.frameUrl,
              hookKey: data.hookKey,
              durationSec: data.durationSec,
            }
          } catch (err) {
            console.warn('[scroll-stop-hook] dispatch threw:', err instanceof Error ? err.message : err)
          }
        })()
      }
    }

    // Motion-broll skips scripts entirely — go straight to the product-hero
    // frame generator. There is no dialogue, no character, no hook picker.
    // Crush-Test with duration >8s skips the pick-frame step entirely and
    // routes through the multi-shot pipeline (auto-generates its own N
    // frames + Seedance jobs then stitches).
    if (isMotionBrollFormat) {
      if (isCrushTestMultiShot) {
        await runCrushTestMultiShot()
      } else {
        await requestHeroFrames('')
      }
      return
    }

    // Visual transformation formats skip the script step — no dialogue.
    // Pass a minimal background-context script so the animate API has
    // something to extract scene context from, but extractSpokenLines
    // returns empty string so Seedance generates a silent visual video.
    if (isNoScriptFormat) {
      const visualScript = `[BACKGROUND: transformation scene for ${productName}]\n[VISUAL: ${activeFormat?.sonnetSpec ?? 'visual transformation — no spoken dialogue'}]`
      setGeneratedScript(visualScript)
      setEditedScript(visualScript)
      await requestHeroFrames(visualScript)
      return
    }

    setScriptError(null)
    setScriptLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/ugc/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productName, productDescription, benefits,
          callToAction: callToAction || 'Try it today',
          productImageBase64: productImage?.base64,
          productImageMimeType: productImage?.mimeType,
          duration,
          character,
          customInstructions: customInstructions.trim() || undefined,
          language,
          productType,
          formatKey: activeFormatKey,
          hasSecondCharacter,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate script')
      if (!data.script) throw new Error('No script returned')
      setGeneratedScript(data.script)
      setEditedScript(data.script)
      setStep('script')
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : 'Failed to generate script')
    } finally {
      setScriptLoading(false)
    }
  }

  const handleHookPick = async (hook: HookVariant) => {
    setHooks(null)
    await runGenerate(hook.text)
  }

  const handleSkipHook = async () => {
    setHooks(null)
    await runGenerate()
  }

  async function handleRevise() {
    if (!reviseInput.trim() || revising) return
    setRevising(true)
    try {
      const supabase = getSupabase()
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/ugc/revise-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentScript: editedScript,
          instruction: reviseInput.trim(),
          productName,
          productDescription,
          benefits,
          callToAction,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.script) throw new Error(data.error || 'Revision failed')
      setEditedScript(data.script)
      setReviseInput('')
    } catch (err) {
      showError('Revision failed', err instanceof Error ? err.message : 'Try again')
    } finally {
      setRevising(false)
    }
  }

  // Hero-frame picker — shown between script review and Kling submission.
  if (step === 'frames') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setStep('script')}
              disabled={animating}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--ink-dim)', fontSize: 13, cursor: animating ? 'not-allowed' : 'pointer',
              }}
            >
              ← Back to script
            </button>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
              Pick your starting frame
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
            We rendered {(frames ?? []).length} options. We&apos;ll animate whichever one you pick — click your favorite to continue.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, position: 'relative' }}>
            {(frames ?? []).map((url, i) => {
              const picked = pickedFrameUrl === url
              return (
              <button
                key={url}
                type="button"
                onClick={() => { setPickedFrameUrl(url); runAnimate(url, editedScript || generatedScript || '') }}
                disabled={animating}
                style={{
                  padding: 0, borderRadius: 12,
                  border: `2px solid ${picked && animating ? 'var(--ink)' : 'var(--border)'}`,
                  background: 'var(--surface)', cursor: animating ? 'wait' : 'pointer',
                  overflow: 'hidden', position: 'relative',
                  transition: 'all 0.15s',
                  opacity: animating && !picked ? 0.35 : 1,
                }}
                onMouseEnter={e => { if (!animating) e.currentTarget.style.borderColor = 'var(--ink)' }}
                onMouseLeave={e => { if (!(picked && animating)) e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Frame ${i + 1}`} style={{ display: 'block', width: '100%', height: 'auto' }} />
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  background: 'rgba(0,0,0,0.65)', color: '#fff',
                  padding: '3px 6px', borderRadius: 4, letterSpacing: '0.06em',
                }}>OPTION {i + 1}</div>
                {picked && animating && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}>
                    <span style={{
                      width: 34, height: 34, borderRadius: '50%',
                      border: '3px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                      animation: 'cf-spin 0.8s linear infinite', display: 'block',
                    }} />
                    <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 600 }}>Animating this one</span>
                  </div>
                )}
              </button>
              )
            })}
          </div>

          {animating && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface-2, var(--surface))',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: '2.5px solid var(--border)', borderTopColor: 'var(--ink)',
                animation: 'cf-spin 0.8s linear infinite', display: 'block',
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                  {ANIMATE_STAGES[animateStageIdx]}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 2 }}>
                  This takes 1-2 minutes — don&apos;t close the tab. The video lands in your Library when it&apos;s ready.
                </div>
              </div>
            </div>
          )}
          <style>{`@keyframes cf-spin { to { transform: rotate(360deg); } }`}</style>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => requestHeroFrames(editedScript || generatedScript || '')}
              disabled={framesLoading || animating}
              style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--ink)', fontSize: 13, cursor: framesLoading ? 'wait' : 'pointer',
              }}
            >
              {framesLoading ? 'Regenerating…' : 'Regenerate frames'}
            </button>
            {studioProductId && frames && frames.length > 0 && (
              <button
                type="button"
                disabled={savedFramesToGallery || animating}
                onClick={async () => {
                  const supabase = getSupabase()
                  if (!supabase) return
                  const { data: sessionData } = await supabase.auth.getSession()
                  const token = sessionData?.session?.access_token
                  if (!token) return
                  const productName = studioProducts.find(p => p.id === studioProductId)?.name ?? 'product'
                  const res = await fetch(`/api/products-studio/${studioProductId}/save-frames`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ frameUrls: frames, concept: `UGC hero frames — ${productName}` }),
                  })
                  if (res.ok) setSavedFramesToGallery(true)
                }}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: savedFramesToGallery ? 'var(--surface-2, var(--surface))' : 'transparent',
                  border: '1px solid var(--border)',
                  color: savedFramesToGallery ? 'var(--ink-mute)' : 'var(--ink)',
                  fontSize: 13, cursor: savedFramesToGallery ? 'default' : 'pointer',
                }}
              >
                {savedFramesToGallery ? '✓ Saved to gallery' : 'Save to product gallery'}
              </button>
            )}
          </div>

          {/* Save-as-reusable-actor bar — shows only when we have a Sonnet
              image prompt from this generation. Clicking a frame picks it
              AND saves it under the name typed here. */}
          {characterImagePrompt && !savedActorId && frames && frames.length > 0 && !isMotionBrollFormat && !isTwoPersonFormat && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: '1px dashed var(--border-strong, var(--border))', background: 'var(--surface-2, var(--surface))' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
                Save this actor for reuse <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>· optional</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', lineHeight: 1.5, marginBottom: 10 }}>
                Give this character a nickname and we&apos;ll keep the exact identity for future ads. When you pick a frame below, it will be saved with that name.
              </div>
              <input
                type="text"
                value={saveActorName}
                onChange={e => setSaveActorName(e.target.value.slice(0, 80))}
                disabled={savingActor || animating}
                placeholder='e.g. "Mia the everyday skincare girl"'
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
                }}
              />
            </div>
          )}

        </section>
      </div>
    )
  }

  // Script review step — shown after "Generate Script" succeeds
  if (step === 'script') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setStep('form')}
              disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--ink-dim)', fontSize: 13, cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              ← Edit form
            </button>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
              Review your script
            </h3>
          </div>

          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
            You can edit the script before generating. Changes here affect what the character says.
          </p>

          <textarea
            value={editedScript}
            onChange={e => setEditedScript(e.target.value)}
            disabled={isLoading || revising}
            rows={16}
            style={{
              width: '100%',
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              lineHeight: 1.65,
              padding: '14px',
              borderRadius: 10,
              border: '1.5px solid var(--border-strong)',
              background: 'var(--bg-elev)',
              color: 'var(--ink)',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          {/* Ask Claude to revise */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-mute)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ask AI to change something
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={reviseInput}
                onChange={e => setReviseInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleRevise()}
                disabled={isLoading || revising}
                placeholder='e.g. "Make the hook more aggressive" · "Shorten to 3 sentences" · "Add more urgency to the CTA"'
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleRevise}
                disabled={!reviseInput.trim() || revising || isLoading}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: 'none',
                  background: 'var(--ink)', color: 'var(--on-ink)',
                  fontSize: 13, fontWeight: 600, cursor: !reviseInput.trim() || revising ? 'not-allowed' : 'pointer',
                  opacity: !reviseInput.trim() || revising ? 0.5 : 1,
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {revising ? (
                  <><span style={{ width: 12, height: 12, border: '2px solid rgba(128,128,128,0.3)', borderTopColor: 'var(--on-ink)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Revising…</>
                ) : 'Revise ↵'}
              </button>
            </div>
          </div>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Cost</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em' }}>
              {totalCredits} <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>cr</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-mute)' }}>
            <span>Your balance</span>
            <span style={{ color: creditBalance >= totalCredits ? 'var(--good)' : 'var(--danger)', fontWeight: 600 }}>
              {creditBalance} credits
            </span>
          </div>

          <button
            type="button"
            disabled={isLoading || framesLoading || !editedScript.trim() || creditBalance < totalCredits}
            onClick={() => runGenerate(undefined, editedScript)}
            className="btn btn-primary"
            style={{ padding: '13px', fontSize: '14px', marginTop: '4px', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            {(framesLoading || isLoading) && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            <span>{framesLoading ? 'Rendering 4 starting frames…' : isLoading ? 'Generating…' : 'Pick starting frame →'}</span>
          </button>

          {creditBalance < totalCredits && (
            <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>
              Not enough credits — need {totalCredits}, have {creditBalance}
            </p>
          )}
        </section>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Format Library trigger — inline replacement for the old sidebar
          entry. Opens a modal with the 28 registered UGC formats. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setShowFormatPicker(true)}
          className="btn btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '9px 14px', border: '1.5px dashed var(--border)', borderRadius: 999, background: 'var(--surface)' }}
        >
          <BookOpen size={14} />
          {activeFormatKey
            ? <>Format: <strong style={{ marginLeft: 2 }}>{CAMPAIGN_FORMATS.find(f => f.key === activeFormatKey)?.label ?? activeFormatKey}</strong> <span style={{ color: 'var(--ink-mute)', marginLeft: 6 }}>· change</span></>
            : <>Pick a format from the Library</>}
        </button>
      </div>

      {/* Scroll-stop hook toggle — admin-only v1. Disabled for POV formats
          where the camera IS a character, and for no-script visual formats. */}
      {isAdminUser && !isNoScriptFormat && !isMotionBrollFormat && (() => {
        const povIncompatible = ['interview-pov', 'interview-man-on-street', 'pov-vlog', 'camera-pov'].includes(activeFormatKey ?? '')
        const selectedHook: ScrollStopHook | undefined = selectedHookKey ? SCROLL_STOP_HOOKS.find(h => h.key === selectedHookKey) : undefined
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', border: '1px dashed var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
            <label
              title={povIncompatible ? 'Not compatible with POV formats' : ''}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: povIncompatible ? 'not-allowed' : 'pointer', opacity: povIncompatible ? 0.5 : 1 }}
            >
              <input
                type="checkbox"
                disabled={povIncompatible}
                checked={hookEnabled && !povIncompatible}
                onChange={e => {
                  setHookEnabled(e.target.checked)
                  if (!e.target.checked) setSelectedHookKey(null)
                }}
              />
              <span>Add scroll-stop hook</span>
              <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Admin · +{SCROLL_STOP_HOOK_COST_CR} cr</span>
            </label>
            {hookEnabled && !povIncompatible && (
              !selectedHook ? (
                <button type="button" onClick={() => setShowHookPicker(true)} className="btn btn-ghost" style={{ fontSize: 12.5, padding: '6px 12px' }}>
                  Choose your hook →
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '5px 10px', background: 'var(--surface-2, var(--surface))', border: '1px solid var(--border)', borderRadius: 999 }}>
                  Hook: <strong>{selectedHook.label}</strong>
                  <button type="button" onClick={() => setShowHookPicker(true)} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 0, fontSize: 12 }}>· change</button>
                </span>
              )
            )}
          </div>
        )
      })()}

      {isAdminUser && showHookPicker && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowHookPicker(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 24, maxWidth: 1000, width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif, serif)', fontSize: 24, lineHeight: 1.15 }}>Scroll-stop hooks</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>A short attention-grabbing clip stitched before the main talking-head. Uses your chosen avatar.</div>
              </div>
              <button type="button" onClick={() => setShowHookPicker(false)} className="btn btn-ghost" style={{ fontSize: 13 }}>Close</button>
            </div>
            {(['entry', 'object', 'environmental', 'meta'] as const).map(cat => {
              const items = SCROLL_STOP_HOOKS.filter(h => h.category === cat && isHookAllowedForFormat(h, activeFormatKey))
              if (!items.length) return null
              const catLabel = cat === 'entry' ? '🎬 Entry' : cat === 'object' ? '📦 Object' : cat === 'environmental' ? '🌍 Environmental' : '🎭 Meta'
              return (
                <div key={cat} style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'var(--ink-2)', marginBottom: 8, textTransform: 'uppercase' }}>{catLabel}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {items.map(h => (
                      <button
                        key={h.key}
                        type="button"
                        onClick={() => { setSelectedHookKey(h.key); setShowHookPicker(false) }}
                        style={{ textAlign: 'left', padding: 12, border: `1.5px solid ${selectedHookKey === h.key ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 10, background: selectedHookKey === h.key ? 'var(--surface-2, var(--surface))' : 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{h.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>{h.tagline}</div>
                        {h.featuresProduct && (
                          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 4, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Features product</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showFormatPicker && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowFormatPicker(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 24, maxWidth: 1000, width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif, serif)', fontSize: 24, lineHeight: 1.15 }}>Format Library</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>Pick a proven UGC format — the builder pre-fills to match.</div>
              </div>
              <button type="button" onClick={() => setShowFormatPicker(false)} className="btn btn-ghost" style={{ fontSize: 13 }}>Close</button>
            </div>
            {(['solo', 'two-person', 'motion', 'transformation'] as const).map(cat => {
              const items = CAMPAIGN_FORMATS.filter(f => f.category === cat)
              if (!items.length) return null
              const catLabel = cat === 'solo' ? 'Solo talking-head' : cat === 'two-person' ? 'Two-person' : cat === 'motion' ? 'Product motion (no dialogue)' : 'Transformation'
              return (
                <div key={cat} style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'var(--ink-2)', marginBottom: 8, textTransform: 'uppercase' }}>{catLabel}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {items.map(fmt => (
                      <button
                        key={fmt.key}
                        type="button"
                        onClick={() => applyFormat(fmt)}
                        style={{ textAlign: 'left', padding: 12, border: `1.5px solid ${activeFormatKey === fmt.key ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 10, background: 'var(--surface-2, var(--surface))', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{fmt.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>{fmt.tagline}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 4, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{fmt.defaultAspect} · {fmt.defaultDuration}s · ~{fmt.creditHint} cr</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Editorial summary strip — a compact overview of the current
          selections. Clicking a card scrolls to the matching step below. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, marginBottom: 4,
      }} className="ugc-summary-grid">
        <button
          type="button"
          onClick={() => toggleStep(2, step2Ref)}
          style={{
            textAlign: 'left', padding: 14, borderRadius: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', minWidth: 0, overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 8 }}>Product</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 44, height: 54, borderRadius: 8, flexShrink: 0,
              background: productImage?.preview ? `url(${productImage.preview}) center/cover` : 'linear-gradient(135deg,#f4f2ed,#e7e4de)',
              border: '1px solid var(--border-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink-fade)', fontSize: 10, letterSpacing: '0.1em',
            }}>{!productImage?.preview && 'NONE'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {productName?.trim() || 'Add your product'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {productDescription?.trim() || 'Photo, name and description'}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-fade)' }}>›</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleStep(3, step3Ref)}
          style={{
            textAlign: 'left', padding: 14, borderRadius: 12,
            background: 'var(--surface)',
            border: hasCreator ? '1px solid var(--border)' : '1px solid var(--danger, #b83a35)',
            cursor: 'pointer', minWidth: 0, overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: hasCreator ? 'var(--ink-fade)' : 'var(--danger, #b83a35)', marginBottom: 8 }}>
            Creator{!hasCreator ? ' · required' : ''}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#fde68a,#fca5a5)',
              border: '1px solid var(--border-soft)',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[character.gender, character.age].filter(Boolean).join(' · ') || 'Pick your creator'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 2 }}>
                {ASPECTS[aspect].label} · {duration}s · {engine === 'seedance-mini' ? 'Seedance Mini' : 'Seedance 2.0'}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-fade)' }}>›</span>
          </div>
        </button>
      </div>

      {/* Video direction — top-level card, always visible. Optional one-line
          brief that shapes the script + shot list. */}
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 8 }}>
          Direction <span style={{ color: 'var(--ink-fade)' }}>· optional</span>
        </div>
        <input
          type="text"
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value.slice(0, 200))}
          disabled={isLoading}
          placeholder='e.g. "clean UGC ad", "unbox", "morning routine", "pain-point storytime"'
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 4px', fontSize: 14.5, color: 'var(--ink)',
            background: 'transparent', border: 'none', outline: 'none',
          }}
        />
      </div>

      {/* Format pill row — each pill cycles its value on click; the arrow
          opens the full Format editor. */}
      {showFormatPills && (() => {
        const aspects = Object.keys(ASPECTS) as UGCAspect[]
        const durations = [...DURATION_OPTIONS]
        const resolutions: UGCResolution[] = engine === 'seedance-mini' ? ['480p', '720p'] : ['480p', '720p', '1080p', '4k']
        function cycle<T>(list: T[], current: T): T { const i = list.indexOf(current); return list[(i + 1) % list.length] }
        const pills: { label: string; onClick: () => void }[] = [
          { label: ASPECTS[aspect].label, onClick: () => { setAspect(cycle(aspects, aspect)); setAspectTouched(true) } },
          { label: `${duration}s`, onClick: () => { setDuration(cycle(durations, duration)); setDurationTouched(true) } },
          { label: resolution, onClick: () => setResolution(cycle(resolutions, resolution)) },
          { label: engine === 'seedance-mini' ? 'Seedance Mini' : 'Seedance 2.0', onClick: () => setEngine(engine === 'seedance-mini' ? 'seedance-2' : 'seedance-mini') },
          { label: (LANGUAGES.find(l => l.code === language)?.name) ?? 'English', onClick: () => { const codes = LANGUAGES.map(l => l.code); const i = codes.indexOf(language); setLanguage(codes[(i + 1) % codes.length]) } },
        ]
        return (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 6px 6px 10px', borderRadius: 999,
            background: 'var(--surface)', border: '1px solid var(--border)',
            width: 'fit-content',
          }}>
            {pills.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={p.onClick}
                title="Click to switch"
                style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                  padding: '5px 11px', borderRadius: 999,
                  background: 'var(--bg-elev)', border: 'none', cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elev)')}
              >{p.label}</button>
            ))}
            <button
              type="button"
              onClick={() => toggleStep(1, step1Ref)}
              aria-label="Open format editor"
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--bg-elev)', border: '1px solid var(--border)',
                color: 'var(--ink-mute)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: 2,
              }}
            >›</button>
          </div>
        )
      })()}

      {/* 1 — Format (tier + duration) — hidden until opened */}
      {openStep === 1 && (
      <section ref={step1Ref} className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Format</h3>
          <button type="button" onClick={() => setOpenStep(null)} style={{ fontSize: 13, color: 'var(--ink-mute)', cursor: 'pointer' }}>Done</button>
        </div>
        <div style={{ height: 12 }} />
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9, marginTop: 14 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Duration</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-fade)' }}>
              ~{Math.round(estimateRenderSeconds(duration) / 60)}m render
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DURATION_OPTIONS.length}, 1fr)`, gap: 8 }}>
            {DURATION_OPTIONS.map(sec => {
              const dCfg = DURATION_CONFIGS[sec]
              const active = duration === sec
              const cost = ugcPackageCost(sec, resolution, engine)
              void creditsToUSD
              const locked = !dCfg.available
              const chained = dCfg.klingClips >= 2
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => { if (!locked) { setDuration(sec); setDurationTouched(true) } }}
                  disabled={isLoading || locked}
                  title={chained ? 'Chained from 2 clips' : undefined}
                  style={{
                    textAlign: 'center',
                    cursor: locked ? 'not-allowed' : (isLoading ? 'not-allowed' : 'pointer'),
                    padding: '10px 6px', borderRadius: 10,
                    border: `1px solid ${(durationTouched && active) ? 'var(--ink)' : 'var(--border)'}`,
                    background: (durationTouched && active) ? 'var(--ink)' : 'var(--surface)',
                    color: (durationTouched && active) ? 'var(--on-ink)' : 'var(--ink)',
                    opacity: locked ? 0.45 : 1,
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{sec}s</span>
                  <span style={{ fontSize: 10.5, opacity: 0.75, fontFamily: 'var(--font-mono)' }}>{cost} cr{isAdmin ? ` · $${creditsToUSD(cost).toFixed(2)}` : ''}</span>
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Aspect</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-fade)' }}>
                {ASPECTS[aspect].soraSize}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(Object.keys(ASPECTS) as UGCAspect[]).map(a => {
                const cfg = ASPECTS[a]
                const active = aspect === a
                // Visual cue: a small box mirroring the aspect inside each button.
                const boxW = a === 'portrait' ? 14 : a === 'tall45' ? 16 : a === 'square' ? 18 : 22
                const boxH = a === 'portrait' ? 22 : a === 'tall45' ? 20 : a === 'square' ? 18 : 12
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setAspect(a); setAspectTouched(true) }}
                    disabled={isLoading}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px', borderRadius: 11,
                      border: `1.5px solid ${(aspectTouched && active) ? 'var(--ink)' : 'var(--border)'}`,
                      background: (aspectTouched && active) ? 'var(--hover)' : 'var(--surface)',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                    <span style={{
                      width: boxW, height: boxH, flexShrink: 0,
                      borderRadius: 3,
                      background: (aspectTouched && active) ? 'var(--ink)' : 'var(--ink-faint)',
                    }} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{cfg.label}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>{cfg.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Resolution picker — Seedance 2.0 supports 720p / 1080p / 4k
             with per-second credit pricing. Multi-shot cutaways removed —
             the Seedance prompt is scene-timestamped and produces its own
             multi-shot output in one continuous render. */}
          {/* Engine — full Seedance vs the low-budget Mini variant */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
              Engine
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                { id: 'seedance-2' as const,    label: 'Seedance 2.0',  note: 'best quality · up to 4K' },
                { id: 'seedance-mini' as const, label: 'Seedance Mini', note: 'low budget · ~½ price · up to 720p' },
                ...(showOmniFlash ? [{ id: 'omni-flash' as const, label: 'Omni Flash · admin', note: 'temp · Vertex Veo · 5-8s · uses trial credit' }] : []),
              ]).map(e => {
                const active = engine === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setEngine(e.id)
                      // Mini caps at 720p — snap higher selections down.
                      if (e.id === 'seedance-mini' && (resolution === '1080p' || resolution === '4k')) setResolution('720p')
                      // Omni Flash: 5-8s only + 720p/1080p only.
                      if (e.id === 'omni-flash') {
                        if (resolution === '480p' || resolution === '4k') setResolution('720p')
                      }
                    }}
                    disabled={isLoading}
                    style={{
                      flex: 1, padding: '12px 10px', borderRadius: 10, textAlign: 'center',
                      border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      color: active ? 'var(--on-ink)' : 'var(--ink)',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>{e.label}</span>
                    <span style={{ fontSize: 10.5, opacity: active ? 0.75 : 1, color: active ? 'var(--on-ink)' : 'var(--ink-dim)', fontWeight: 500 }}>
                      {e.note}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
              Resolution <span style={{ fontWeight: 400, color: 'var(--ink-mute)' }}>· lower is cheaper</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(engine === 'seedance-mini'
                ? [
                    { id: '480p' as const, label: '480p', perSec: 3, note: 'draft' },
                    { id: '720p' as const, label: '720p', perSec: 7, note: 'social' },
                  ]
                : [
                    { id: '480p' as const,  label: '480p',  perSec: 6,  note: 'draft' },
                    { id: '720p' as const,  label: '720p',  perSec: 13, note: 'social' },
                    { id: '1080p' as const, label: '1080p', perSec: 33, note: 'default' },
                    { id: '4k' as const,    label: '4K',    perSec: 72, note: 'premium' },
                  ]
              ).map(r => {
                const active = resolution === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setResolution(r.id)}
                    disabled={isLoading}
                    style={{
                      flex: 1, padding: '12px 8px', borderRadius: 10, textAlign: 'center',
                      border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      color: active ? 'var(--on-ink)' : 'var(--ink)',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{r.label}</span>
                    <span style={{ fontSize: 10.5, opacity: active ? 0.75 : 1, color: active ? 'var(--on-ink)' : 'var(--ink-dim)', fontWeight: 500 }}>
                      {r.perSec} cr/s{isAdmin ? ` · $${(r.perSec * 0.025).toFixed(3)}/s` : ''} · {r.note}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      </section>
      )}

      {/* 2 — Your product — hidden until opened */}
      {openStep === 2 && unlockedStep >= 2 && (
      <section ref={step2Ref} className="card step-reveal" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Your product</h3>
          <button type="button" onClick={() => setOpenStep(null)} style={{ fontSize: 13, color: 'var(--ink-mute)', cursor: 'pointer' }}>Done</button>
        </div>
        <>
        {/* Product Studio import — one click fills name, description, and
            all reference angles (main photo + extras). */}
        {studioProducts.length > 0 && (
          <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>From Product Studio</span>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 'auto' }}>fills everything incl. photos</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {studioProducts.map(sp => {
                const active = studioProductId === sp.id
                return (
                  <button
                    key={sp.id}
                    type="button"
                    disabled={isLoading}
                    onClick={async () => {
                      if (active) { setStudioProductId(undefined); return }
                      setStudioProductId(sp.id)
                      setProductName(sp.name)
                      if (sp.description) setProductDescription(sp.description)
                      const urls = Array.isArray(sp.photo_urls) ? sp.photo_urls : []
                      const angles = Array.isArray(sp.photo_angles) ? sp.photo_angles : []
                      // If the studio product is an app, flip productType so the
                      // routes render the reference on a device screen.
                      if (sp.product_type === 'app') setProductType('website')
                      // Pick primary based on the picked format's framing needs:
                      // POV/interview → mobile screenshot (phone framing);
                      // everything else → landing page (laptop framing).
                      const { url: primaryUrl, angle: primaryAngle, restIndices } = pickPrimaryAppPhoto(
                        { photo_urls: urls, photo_angles: angles, product_type: sp.product_type },
                        activeFormatKey ?? null,
                      )
                      if (primaryUrl) {
                        const main = await loadBrandImage(primaryUrl)
                        if (main) setProductImage(main)
                        setPrimaryPhotoAngle(primaryAngle ?? '')
                      }
                      const extras: Array<{ base64: string; mimeType: string; preview: string; angle?: string }> = []
                      for (const i of restIndices.slice(0, 2)) {
                        const img = await loadBrandImage(urls[i])
                        if (img) extras.push({ ...img, angle: (angles[i] ?? '') || '' })
                      }
                      setExtraProductImages(extras)
                      showSuccess('Product imported', `${sp.name} — ${Math.min(urls.length, 3)} photo${urls.length > 1 ? 's' : ''} loaded.`)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: 6, paddingRight: 12,
                      borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      background: active ? 'var(--surface)' : 'var(--bg)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sp.photo_urls?.[0]} alt={sp.name} style={{ width: 36, height: 36, borderRadius: 7, objectFit: 'cover', display: 'block' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{sp.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Shopify Product Picker — hidden behind More details */}
        {showProductAdvanced && (
        <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Import from Shopify</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 'auto' }}>optional</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="yourstore.myshopify.com"
              value={shopifyUrl}
              onChange={e => setShopifyUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchShopifyProducts()}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
            />
            <button
              type="button"
              onClick={fetchShopifyProducts}
              disabled={!shopifyUrl.trim() || shopifyLoading}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: shopifyUrl.trim() && !shopifyLoading ? 'pointer' : 'not-allowed', opacity: shopifyUrl.trim() && !shopifyLoading ? 1 : 0.4, whiteSpace: 'nowrap' as const, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {shopifyLoading ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(128,128,128,0.3)', borderTopColor: 'var(--on-ink)', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Loading...</> : 'Fetch Products'}
            </button>
          </div>
          {shopifyError && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#e84040', padding: '6px 10px', borderRadius: 6, background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.2)' }}>
              {shopifyError}. Make sure the URL is correct (e.g. yourstore.myshopify.com).
            </div>
          )}
          {shopifyProducts && shopifyProducts.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-mute)' }}>No products found in this store.</div>
          )}
          {shopifyProducts && shopifyProducts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--ink-mute)', marginBottom: 8 }}>{shopifyProducts.length} products — pick one to advertise</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, maxHeight: 260, overflowY: 'auto' as const }}>
                {shopifyProducts.map(product => {
                  const isSelected = selectedShopifyProduct?.id === product.id
                  return (
                    <div key={product.id} onClick={() => applyShopifyProduct(product)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isSelected ? 'var(--ink)' : 'var(--border)'}`, background: isSelected ? 'var(--accent-soft)' : 'var(--surface)', transition: 'all 0.15s' }}>
                      {product.images[0]
                        ? <img src={product.images[0]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                        : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{product.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>${product.price}</div>
                      </div>
                      {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  )
                })}
              </div>
              {selectedShopifyProduct && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-mute)' }}>✓ {selectedShopifyProduct.title} selected — fields below pre-filled</div>}
            </div>
          )}
        </div>
        )}

        {/* Brand profile toggle — only render when a brand profile actually exists.
            On = pre-fills the 4 fields from /settings/brand. Off = manual entry. */}
        {brand && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 11,
            background: useBrand ? 'var(--ink)' : 'var(--surface-2)',
            border: `1px solid ${useBrand ? 'var(--ink)' : 'var(--border)'}`,
            color: useBrand ? 'var(--on-ink)' : 'var(--ink)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <span style={{
              position: 'relative', flexShrink: 0,
              width: 32, height: 18, borderRadius: 99,
              background: useBrand ? 'var(--on-ink-subtle)' : 'var(--border-strong)',
              transition: 'background 0.15s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: useBrand ? 16 : 2,
                width: 14, height: 14, borderRadius: '50%',
                background: useBrand ? 'var(--on-ink)' : '#fff', transition: 'left 0.15s',
              }} />
            </span>
            <input type="checkbox" checked={useBrand} onChange={e => toggleUseBrand(e.target.checked)}
              disabled={isLoading}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Use my brand profile
              </div>
              <div style={{
                fontSize: 11.5,
                color: useBrand ? 'var(--on-ink-mute)' : 'var(--ink-mute)',
                marginTop: 2,
              }}>
                {useBrand ? `Pre-filled with “${brand.productName}”` : 'Or fill the fields manually below'}
              </div>
            </div>
          </label>
        )}

        {/* Product picker — shown when the catalog has 2+ products. Lets a
            t-shirt brand (etc.) pick which SKU this UGC is for. */}
        {useBrand && products.length > 1 && (
          <div>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
              Which product?
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {products.map(p => {
                const active = selectedProductId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p.id)}
                    disabled={isLoading}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      padding: 8, borderRadius: 11,
                      background: active ? 'var(--hover)' : 'var(--surface)',
                      border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s', textAlign: 'left',
                    }}>
                    <div style={{ aspectRatio: '1', borderRadius: 7, overflow: 'hidden', background: 'var(--bg-elev)' }}>
                      {p.image_url && (
                        <img src={p.image_url} alt={p.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                      letterSpacing: '-0.01em', lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    }}>{p.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}


        <div className="form-row">
          <label className="form-label">Product name</label>
          <input className="input" value={productName} onChange={e => { setProductName(e.target.value); if (useBrand) setUseBrand(false) }}
            placeholder="e.g. ContentFlow" disabled={isLoading} />
        </div>

        <div className="form-row">
          <label className="form-label">One-line description</label>
          <textarea className="textarea" rows={3} value={productDescription}
            onChange={e => { setProductDescription(e.target.value); if (useBrand) setUseBrand(false) }}
            placeholder="What it is and who it's for, in a sentence." disabled={isLoading} />
        </div>

        {!showProductAdvanced && (
          <button type="button" onClick={() => setShowProductAdvanced(true)} style={{ fontSize: 12.5, color: 'var(--ink-mute)', textAlign: 'left', padding: '4px 2px', cursor: 'pointer', width: 'fit-content' }}>
            More details (CTA, Shopify import) →
          </button>
        )}

        {showProductAdvanced && (
        <div className="form-row">
          <label className="form-label">Call to action</label>
          <input className="input" value={callToAction} onChange={e => { setCallToAction(e.target.value); if (useBrand) setUseBrand(false) }}
            placeholder="e.g. Try it free today" disabled={isLoading} />
        </div>
        )}


        <div className="form-row">
          {/* Product-type segmented toggle. Website mode swaps the file
              upload for a URL input that fetches a landing-page screenshot
              via /api/screenshot and drops it into productImage. */}
          <div style={{ display: 'inline-flex', padding: 3, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 12 }}>
            {(['physical', 'website'] as const).map(pt => {
              const active = productType === pt
              const isPhysical = pt === 'physical'
              return (
                <button
                  key={pt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    if (pt === productType) return
                    setProductType(pt)
                    setProductImage(null)
                    setWebsiteError(null)
                    if (pt === 'physical') setWebsiteUrl('')
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                    border: 'none', minWidth: 148, justifyContent: 'center',
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--on-ink, var(--paper))' : 'var(--ink-mute, var(--ink-2))',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'background 140ms, color 140ms',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {isPhysical ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  )}
                  <span>{isPhysical ? 'Physical product' : 'App / Website'}</span>
                </button>
              )
            })}
          </div>
          {productType === 'website' && isMotionBrollFormat && (
            <div style={{ padding: '8px 10px', marginBottom: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2, var(--surface))', fontSize: 11.5, color: 'var(--ink-dim)' }}>
              Heads up — motion-broll / product-still formats are built around physical objects. Website products render better with talking-head formats.
            </div>
          )}
          <label className="form-label">
            {productType === 'website' ? 'Website URL' : 'Product photo'}{' '}
            <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>(recommended)</span>
          </label>
          <p className="help">
            {productType === 'website'
              ? 'Paste your app or landing-page URL. We fetch a screenshot and the AI puts a laptop (or phone for POV) in the character\'s hands with your website on screen.'
              : 'Our AI composites your real product into the video first frame. Skip it and we\'ll build a character-only ad.'}
          </p>
          {productType === 'website' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <input
                className="input"
                style={{ flex: '1 1 260px' }}
                type="url"
                placeholder="https://your-app.com"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                disabled={isLoading || websiteFetching}
              />
              <button
                type="button"
                className="btn"
                disabled={isLoading || websiteFetching || !websiteUrl.trim()}
                onClick={async () => {
                  setWebsiteError(null)
                  setWebsiteFetching(true)
                  try {
                    const res = await fetch('/api/screenshot', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: websiteUrl.trim() }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Failed to fetch screenshot')
                    setProductImage({
                      base64: data.imageBase64,
                      mimeType: data.mimeType || 'image/png',
                      preview: `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`,
                    })
                  } catch (err) {
                    setWebsiteError(err instanceof Error ? err.message : 'Screenshot failed')
                  } finally {
                    setWebsiteFetching(false)
                  }
                }}
              >
                {websiteFetching ? 'Fetching…' : productImage ? 'Refetch' : 'Fetch website'}
              </button>
            </div>
          )}
          {websiteError && productType === 'website' && (
            <div style={{ fontSize: 12, color: 'var(--danger, #c34)', marginBottom: 10 }}>{websiteError}</div>
          )}
          {productType === 'website' && productImage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productImage.preview} alt="website screenshot" style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Screenshot captured</p>
                <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{websiteUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => { setProductImage(null); setWebsiteError(null) }}
                disabled={isLoading}
                style={{ fontSize: 18, lineHeight: 1, background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: '0 4px' }}
              >×</button>
            </div>
          ) : productType === 'physical' && (
          <label {...productDrop.dropzoneProps} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '12px 14px', borderRadius: 12,
            border: `1.5px dashed ${productDrop.isDragging ? 'var(--ink)' : 'var(--border-strong)'}`,
            cursor: isLoading ? 'default' : 'pointer',
            background: productDrop.isDragging ? 'var(--hover)' : 'var(--bg-elev)',
            transition: 'border-color 0.15s, background 0.15s',
          }}>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange} disabled={isLoading}
              style={{ display: 'none' }} />
            {productImage ? (
              <>
                <img src={productImage.preview} alt="Product"
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Photo added</p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-mute)', margin: '2px 0 0' }}>Click to change</p>
                </div>
                <button type="button" onClick={e => { e.preventDefault(); setProductImage(null) }}
                  disabled={isLoading}
                  style={{ fontSize: '18px', lineHeight: 1, background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: '0 4px' }}>
                  ×
                </button>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Drop product photo</p>
                  <p style={{ fontSize: '11px', color: 'var(--ink-mute)', margin: '2px 0 0', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>PNG · JPG · WEBP</p>
                </div>
              </>
            )}
          </label>
          )}

          {/* Extra photos of the SAME product — e.g. the package AND what's
              inside. Both feed Nano Banana + Seedance as combined refs.
              Website mode skips these — one screenshot is all we need. */}
          {productImage && productType === 'physical' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {extraProductImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={img.preview} alt={`extra product ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setExtraProductImages(prev => prev.filter((_, j) => j !== i))}
                    disabled={isLoading}
                    style={{ position: 'absolute', top: 1, right: 1, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ))}
              {extraProductImages.length < 2 && (
                <>
                  <input
                    id="extraProductInput"
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const files = Array.from(e.target.files ?? []).slice(0, 2 - extraProductImages.length)
                      e.target.value = ''
                      for (const f of files) {
                        try {
                          const compressed = await compressImageFile(f)
                          setExtraProductImages(prev => prev.length < 2 ? [...prev, compressed] : prev)
                        } catch { showError('Image failed', `Could not read ${f.name}`) }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('extraProductInput')?.click()}
                    disabled={isLoading}
                    {...extraProductDrop.dropzoneProps}
                    style={{ width: 48, height: 48, borderRadius: 8, border: `1.5px dashed ${extraProductDrop.isDragging ? 'var(--ink)' : 'var(--border)'}`, background: extraProductDrop.isDragging ? 'var(--hover)' : 'var(--surface)', color: extraProductDrop.isDragging ? 'var(--ink)' : 'var(--ink-mute)', cursor: 'pointer', fontSize: 20, lineHeight: 1, transition: 'background 120ms, border-color 120ms, color 120ms' }}
                    title="Add another photo of the same product — drag & drop works too"
                  >+</button>
                </>
              )}
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', maxWidth: 300, lineHeight: 1.4 }}>
                Optional: more photos of the same product — e.g. the package and what&apos;s inside. The AI uses all of them.
              </span>
            </div>
          )}

          {/* Packaging reference — shown for unboxing-style formats where the
              on-camera reveal depends on a distinct openable box. If left
              empty the routes instruct Nano Banana to invent a plausible
              branded shipping box for the product. */}
          {productImage && wantsPackagingPhoto && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                id="packagingInput"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const compressed = await compressImageFile(f)
                    setPackagingImage(compressed)
                  } catch { showError('Image failed', `Could not read ${f.name}`) }
                }}
              />
              {packagingImage ? (
                <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={packagingImage.preview} alt="packaging" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setPackagingImage(null)}
                    disabled={isLoading}
                    style={{ position: 'absolute', top: 1, right: 1, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById('packagingInput')?.click()}
                  disabled={isLoading}
                  style={{ width: 48, height: 48, borderRadius: 8, border: '1.5px dashed var(--border)', background: 'var(--surface)', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
                  title="Upload a photo of the packaging / shipping box"
                >+</button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 300 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  Packaging photo (optional)
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.4 }}>
                  {packagingImage
                    ? 'The AI will use this as the exact box to open.'
                    : 'Leave empty and we’ll invent a branded box.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {unlockedStep < 3 && (
          <button
            type="button"
            onClick={() => advanceTo(3, step3Ref)}
            className="btn btn-primary"
            style={{ padding: '12px', fontSize: 14, borderRadius: 11, marginTop: 4 }}
          >
            Continue →
          </button>
        )}
        </>
      </section>
      )}

      {/* 3 — Character + voice — hidden until opened */}
      {openStep === 3 && unlockedStep >= 3 && (
      <section ref={step3Ref} className="card step-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Character &amp; setting</h3>
          <button type="button" onClick={() => setOpenStep(null)} style={{ fontSize: 13, color: 'var(--ink-mute)', cursor: 'pointer' }}>Done</button>
        </div>
        <>

          <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.5 }}>
            Skip everything and let AI build a character to fit your product, or lock in specific fields (gender, age, hair, wardrobe…) and we&apos;ll respect them exactly. Or reuse an actor you&apos;ve saved before for identity consistency.
          </p>

          {/* Scene Studio picker — sets the location the UGC happens in. */}
          {scenes.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                Scene
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setSceneId(undefined)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                    background: !sceneId ? 'var(--ink)' : 'var(--surface)',
                    color: !sceneId ? 'var(--on-ink)' : 'var(--ink-2)',
                    border: `1.5px solid ${!sceneId ? 'var(--ink)' : 'var(--border)'}`,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >Auto</button>
                {scenes.map(s => {
                  const active = sceneId === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setSceneId(active ? undefined : s.id)}
                      title={s.name}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: 0,
                        borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                        border: `2px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        background: 'var(--surface)',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {s.hero_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.hero_image_url} alt={s.name} style={{ width: 52, height: 36, objectFit: 'cover', display: 'block' }} />
                      )}
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '0 10px 0 0' }}>{s.name}</span>
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '6px 0 0' }}>
                Pick a Scene from your <em>Scene Studio</em> and the UGC renders inside that exact place. Leave on <b>Auto</b> and the AI picks a scene from your description.
              </p>
            </div>
          )}
          {influencers.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                My influencers
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {influencers.map(inf => {
                  const active = selectedInfluencerId === inf.id
                  return (
                    <button
                      key={inf.id}
                      type="button"
                      disabled={isLoading || bridgingInfluencer}
                      onClick={async () => {
                        if (active) {
                          setSelectedInfluencerId(undefined)
                          setSavedActorId(undefined)
                          setInfluencerGallery([])
                          setInfluencerPhotoUrl(undefined)
                          return
                        }
                        // Bridge the influencer into saved actors (idempotent)
                        // and reuse the existing savedActorId pipeline.
                        setBridgingInfluencer(true)
                        try {
                          const supabase = getSupabase()
                          const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
                          const token = sess?.session?.access_token
                          if (!token) throw new Error('Not signed in')
                          const res = await fetch(`/api/influencers/${inf.id}/use-in-ugc`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          })
                          const data = await res.json()
                          if (!res.ok || !data.actor?.id) throw new Error(data.error || 'Failed to load influencer')
                          setSelectedInfluencerId(inf.id)
                          setSavedActorId(data.actor.id)
                          setInfluencerPhotoUrl(undefined)
                          setSavedActors(prev => prev.some(a => a.id === data.actor.id)
                            ? prev
                            : [{ id: data.actor.id, name: data.actor.name, hero_frame_url: data.actor.hero_frame_url, character_idea: null, last_used_at: new Date().toISOString() }, ...prev])
                          // Load their gallery so the user can optionally
                          // hand-pick the identity reference photo.
                          try {
                            const gRes = await fetch(`/api/influencers/${inf.id}`, { headers: { Authorization: `Bearer ${token}` } })
                            const gData = await gRes.json()
                            if (gRes.ok) {
                              const pics = Array.isArray(gData.photos) ? gData.photos : []
                              setInfluencerGallery([
                                { id: 'portrait', image_url: gData.influencer?.portrait_url, scene: 'Canonical portrait' },
                                ...pics,
                              ].filter(p => typeof p.image_url === 'string'))
                            }
                          } catch { /* gallery is optional */ }
                        } catch (err) {
                          showError('Influencer failed', err instanceof Error ? err.message : 'Try again')
                        } finally {
                          setBridgingInfluencer(false)
                        }
                      }}
                      style={{
                        padding: 6, borderRadius: 10, textAlign: 'left',
                        border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        background: active ? 'var(--surface-2)' : 'var(--surface)',
                        cursor: isLoading || bridgingInfluencer ? 'not-allowed' : 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 6,
                        opacity: bridgingInfluencer && !active ? 0.6 : 1,
                      }}
                    >
                      <img
                        src={inf.portrait_url}
                        alt={inf.name}
                        style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 7, display: 'block' }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inf.name}
                      </div>
                      {inf.niche && (
                        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inf.niche}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              {selectedInfluencerId && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 8, fontStyle: 'italic' }}>
                  Using this influencer — the persona fields below are ignored on this generation.
                </div>
              )}

              {/* Identity reference picker: AI uses the whole gallery by
                  default, or the user locks one specific photo. */}
              {selectedInfluencerId && influencerGallery.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px dashed var(--border)', background: 'var(--surface-2, var(--surface))' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
                    Which photo should anchor their look?
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', lineHeight: 1.5, marginBottom: 10 }}>
                    By default the AI uses their whole gallery. Or click one photo to lock it as the exact reference (useful to keep a specific outfit or setting).
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <button
                      type="button"
                      onClick={() => setInfluencerPhotoUrl(undefined)}
                      disabled={isLoading}
                      style={{
                        width: 74, height: 98, borderRadius: 9, fontSize: 10.5, fontWeight: 600, lineHeight: 1.35,
                        border: `1.5px solid ${!influencerPhotoUrl ? 'var(--ink)' : 'var(--border)'}`,
                        background: !influencerPhotoUrl ? 'var(--ink)' : 'var(--surface)',
                        color: !influencerPhotoUrl ? 'var(--on-ink)' : 'var(--ink-2)',
                        cursor: 'pointer', padding: 6,
                      }}
                    >
                      ✨ Let AI use the gallery
                    </button>
                    {influencerGallery.map(p => {
                      const chosen = influencerPhotoUrl === p.image_url
                      return (
                        <button
                          key={p.id}
                          type="button"
                          title={p.scene}
                          onClick={() => setInfluencerPhotoUrl(chosen ? undefined : p.image_url)}
                          disabled={isLoading}
                          style={{
                            width: 74, height: 98, borderRadius: 9, overflow: 'hidden', padding: 0,
                            border: `2px solid ${chosen ? 'var(--ink)' : 'var(--border)'}`,
                            cursor: 'pointer', background: 'var(--surface)',
                          }}
                        >
                          <img src={p.image_url} alt={p.scene ?? 'gallery photo'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: chosen ? 1 : 0.92 }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Second character — available whenever a main influencer is
                  picked, regardless of format. Setting this OR ticking auto-
                  generate routes the whole pipeline (frames + script) to
                  two-person mode. */}
              {selectedInfluencerId && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px dashed var(--border)', background: 'var(--surface-2, var(--surface))' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
                    {secondInfluencerId
                      ? `Co-starring: ${influencers.find(i => i.id === secondInfluencerId)?.name ?? 'saved influencer'}`
                      : isTwoPersonFormat
                        ? 'Second character'
                        : 'Add a co-star (optional)'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', lineHeight: 1.5, marginBottom: 10 }}>
                    {isTwoPersonFormat
                      ? 'This format needs two people in the frame. By default the AI generates the second character — swap in another saved influencer to have them co-star.'
                      : 'Put a second person in the frame with your main influencer. Pick another saved influencer, or let the AI generate one — either way, we switch to two-person dialogue and two-shot framing.'}
                  </div>
                  {!isTwoPersonFormat && !secondInfluencerId && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 10, cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={useAutoSecondChar}
                        onChange={e => setUseAutoSecondChar(e.target.checked)}
                        disabled={isLoading}
                      />
                      Auto-generate a second character
                    </label>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {(() => {
                      const co = secondInfluencerId ? influencers.find(i => i.id === secondInfluencerId) : null
                      if (co) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 9, border: '1.5px solid var(--ink)', background: 'var(--surface)' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={co.portrait_url} alt={co.name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{co.name}</span>
                            <button
                              type="button"
                              onClick={() => setSecondInfluencerId(null)}
                              disabled={isLoading}
                              style={{ marginLeft: 4, background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                              aria-label="Remove co-star"
                            >×</button>
                          </div>
                        )
                      }
                      return (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '6px 10px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                          {secondCharacterRoleLabel}
                        </span>
                      )
                    })()}
                    {influencers.filter(i => i.id !== selectedInfluencerId).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowSecondPicker(v => !v)}
                        disabled={isLoading}
                        style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {showSecondPicker ? 'Close' : (secondInfluencerId ? 'Change' : 'Pick from Influencers')}
                      </button>
                    )}
                  </div>
                  {showSecondPicker && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                      {influencers.filter(i => i.id !== selectedInfluencerId).map(inf => {
                        const active = secondInfluencerId === inf.id
                        return (
                          <button
                            key={inf.id}
                            type="button"
                            disabled={isLoading}
                            onClick={() => { setSecondInfluencerId(active ? null : inf.id); setShowSecondPicker(false) }}
                            style={{
                              padding: 5, borderRadius: 9, textAlign: 'left',
                              border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                              background: active ? 'var(--surface-2)' : 'var(--surface)',
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              display: 'flex', flexDirection: 'column', gap: 4,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={inf.portrait_url} alt={inf.name} style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inf.name}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Filter out saved actors that duplicate an influencer by name —
              influencers auto-save as actors, so both lists showed the same
              people. */}
          {(() => {
            const infNames = new Set(influencers.map(i => i.name?.toLowerCase().trim()).filter(Boolean))
            const uniqueSavedActors = savedActors.filter(a => !infNames.has(a.name?.toLowerCase().trim()))
            if (!uniqueSavedActors.length) return null
            return (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                Your saved actors
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {uniqueSavedActors.map(a => {
                  const active = savedActorId === a.id
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setSavedActorId(active ? undefined : a.id); setSelectedInfluencerId(undefined) }}
                      disabled={isLoading}
                      style={{
                        padding: 6, borderRadius: 10, textAlign: 'left',
                        border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        background: active ? 'var(--surface-2)' : 'var(--surface)',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}
                    >
                      <img
                        src={a.hero_frame_url}
                        alt={a.name}
                        style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 7, display: 'block' }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </div>
                    </button>
                  )
                })}
              </div>
              {savedActorId && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 8, fontStyle: 'italic' }}>
                  Reusing a saved actor — the persona fields below are ignored on this generation.
                </div>
              )}
            </div>
            )
          })()}

          <CharacterBuilder
            value={character}
            onChange={profile => setCharacter(profile)}
            disabled={isLoading || !!savedActorId}
            saveName={saveActorName}
            onSaveNameChange={name => setSaveActorName(name.slice(0, 80))}
          />

          {unlockedStep < 4 && (
            <button
              type="button"
              onClick={() => advanceTo(4, step4Ref)}
              className="btn btn-primary"
              style={{ padding: '12px', fontSize: 14, borderRadius: 11, marginTop: 4 }}
            >
              Continue →
            </button>
          )}
        </>
      </section>
      )}

      {/* 4 — Customize — advanced, opened via link below */}
      {openStep === 4 && unlockedStep >= 4 && (
      <section ref={step4Ref} className="card step-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Customize</h3>
          <button type="button" onClick={() => setOpenStep(null)} style={{ fontSize: 13, color: 'var(--ink-mute)', cursor: 'pointer' }}>Done</button>
        </div>
        <>

        <div className="form-row">
          <label className="form-label">Language</label>
          <p className="help">Script, hooks, voice and captions render in this language. Lip-sync follows the spoken language.</p>
          <select className="select" value={language} onChange={e => setLanguage(e.target.value)} disabled={isLoading}>
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeLabel} {lang.code !== 'en' ? `— ${lang.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Video direction lives at the top level now — not duplicated here. */}

        {unlockedStep < 5 && (
          <button
            type="button"
            onClick={() => advanceTo(5, step5Ref)}
            className="btn btn-primary"
            style={{ padding: '12px', fontSize: 14, borderRadius: 11, marginTop: 4 }}
          >
            Continue →
          </button>
        )}
        </>
      </section>
      )}

      {/* Small link to open advanced customization when needed */}
      {openStep !== 4 && (
        <button type="button" onClick={() => toggleStep(4, step4Ref)} style={{ fontSize: 12, color: 'var(--ink-mute)', textAlign: 'left', padding: '4px 2px', cursor: 'pointer', width: 'fit-content' }}>
          Advanced customization →
        </button>
      )}

      {/* 5 — Cost summary + generate */}
      {unlockedStep >= 5 && (
      <section ref={step5Ref} className="card step-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="section-step-head" style={{ marginBottom: 0 }}>
          <span className="step-circle">5</span>
          <h3>Ready when you are</h3>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Cost</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em' }}>{totalCredits} <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>cr</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-mute)' }}>
          <span>Your balance</span>
          <span style={{ color: creditBalance >= totalCredits ? 'var(--good)' : 'var(--danger)', fontWeight: 600 }}>
            {creditBalance} credits
          </span>
        </div>

        {isPhotoFormat ? (
          <a
            href={`/generate/products?formatKey=${encodeURIComponent(activeFormat?.key ?? '')}&mode=aesthetic&substyle=${
              activeFormat?.pipeline === 'hero-editorial' ? 'editorial' :
              activeFormat?.pipeline === 'lifestyle-photo' ? 'lifestyle' : 'studio'
            }${productName.trim() ? `&productName=${encodeURIComponent(productName.trim())}` : ''}${productDescription.trim() ? `&productDescription=${encodeURIComponent(productDescription.trim())}` : ''}`}
            style={{ padding: '13px', fontSize: '14px', marginTop: '4px', borderRadius: 11, textAlign: 'center', textDecoration: 'none' }}
            className="btn btn-primary"
          >
            This is a photo format — use Product Studio →
          </a>
        ) : (
          <button type="submit" disabled={!canGenerate || isLoading || scriptLoading || framesLoading} className="btn btn-primary"
            style={{ padding: '13px', fontSize: '14px', marginTop: '4px', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {(scriptLoading || framesLoading || isLoading) && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            <span>{scriptLoading ? 'Writing script…' : (framesLoading ? 'Rendering frames…' : ((isMotionBrollFormat || isNoScriptFormat) ? 'Generate Frames →' : 'Generate Script →'))}</span>
          </button>
        )}

        {scriptError && (
          <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', margin: 0 }}>{scriptError}</p>
        )}

        {(!canGenerate || creditBalance < totalCredits) && productName && (
          <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>
            {creditBalance < totalCredits
              ? `Not enough credits — need ${totalCredits}, have ${creditBalance}`
              : 'Fill in all required fields'}
          </p>
        )}
      </section>
      )}

      {hooks && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !isLoading && setHooks(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', padding: '24px',
              maxWidth: '560px', width: '100%',
              display: 'flex', flexDirection: 'column', gap: '16px',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>Pick your hook</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-dim)' }}>
                Different angles for the first 5 seconds. Picking one charges {totalCredits} credits.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hooks.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleHookPick(h)}
                  disabled={isLoading}
                  style={{
                    textAlign: 'left', cursor: isLoading ? 'not-allowed' : 'pointer',
                    padding: '14px 16px', borderRadius: 'var(--r-md)',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase',
                      color: 'var(--ink-2)', background: 'var(--hover)',
                      borderRadius: 5, padding: '2px 8px',
                    }}>
                      {h.angle}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>{h.tone}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.5, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                    “{h.text}”
                  </p>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
              <button type="button" onClick={() => setHooks(null)} disabled={isLoading}
                className="btn btn-ghost" style={{ fontSize: '13px' }}>
                Cancel
              </button>
              <button type="button" onClick={handleSkipHook} disabled={isLoading}
                className="btn btn-ghost" style={{ fontSize: '13px' }}>
                Use original hook
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
