import { NextResponse } from 'next/server'

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url?: string
  is_public: boolean
  // Hex pair for the gradient fallback tile so each avatar has a distinct visual identity
  accent?: [string, string]
}

// Curated HeyGen stock avatars — hand-picked for UGC use, all known-good IDs that work with
// /v2/video/generate. We don't hit HeyGen's slow /v2/avatars endpoint on the request path.
// The AvatarPicker renders a gradient + name tile when a preview image fails to load, so a
// dead CDN URL never breaks the picker.
const CURATED_AVATARS: HeyGenAvatar[] = [
  { avatar_id: 'Daisy-inskirt-20220818',         avatar_name: 'Daisy',  gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Daisy-inskirt-20220818/full/2.2/preview_target.webp',         is_public: true, accent: ['#F8C9D2', '#D87DA1'] },
  { avatar_id: 'Anna_public_3_20240108',         avatar_name: 'Anna',   gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Anna_public_3_20240108/full/2.2/preview_target.webp',         is_public: true, accent: ['#FFD3A5', '#FD9853'] },
  { avatar_id: 'Susan_public_2_20240328',        avatar_name: 'Susan',  gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Susan_public_2_20240328/full/2.2/preview_target.webp',        is_public: true, accent: ['#D6B4FC', '#7E5BEF'] },
  { avatar_id: 'Grace-inblackskirt-20220820',    avatar_name: 'Grace',  gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Grace-inblackskirt-20220820/full/2.2/preview_target.webp',    is_public: true, accent: ['#A0E7E5', '#3DB6B0'] },
  { avatar_id: 'Monica_inwhitedress_20240131',   avatar_name: 'Monica', gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Monica_inwhitedress_20240131/full/2.2/preview_target.webp',   is_public: true, accent: ['#FFAFBD', '#FFC371'] },
  { avatar_id: 'Eric_public_pro2_20230608',      avatar_name: 'Eric',   gender: 'Male',   preview_image_url: 'https://files2.heygen.ai/avatar/v3/Eric_public_pro2_20230608/full/2.2/preview_target.webp',      is_public: true, accent: ['#83C5BE', '#006D77'] },
  { avatar_id: 'Tyler-incasualsuit-20220721',    avatar_name: 'Tyler',  gender: 'Male',   preview_image_url: 'https://files2.heygen.ai/avatar/v3/Tyler-incasualsuit-20220721/full/2.2/preview_target.webp',    is_public: true, accent: ['#8FA5C9', '#3B5481'] },
  { avatar_id: 'Shawn_public_3_20231116',        avatar_name: 'Shawn',  gender: 'Male',   preview_image_url: 'https://files2.heygen.ai/avatar/v3/Shawn_public_3_20231116/full/2.2/preview_target.webp',        is_public: true, accent: ['#B8C5A7', '#5E7C4F'] },
  { avatar_id: 'Noah_public_3_20240111',         avatar_name: 'Noah',   gender: 'Male',   preview_image_url: 'https://files2.heygen.ai/avatar/v3/Noah_public_3_20240111/full/2.2/preview_target.webp',         is_public: true, accent: ['#FFCC70', '#C06C84'] },
  { avatar_id: 'Wayne_20240711',                 avatar_name: 'Wayne',  gender: 'Male',   preview_image_url: 'https://files2.heygen.ai/avatar/v3/Wayne_20240711/full/2.2/preview_target.webp',                 is_public: true, accent: ['#E0BBE4', '#957DAD'] },
  { avatar_id: 'Marco_public_3_20240108',        avatar_name: 'Marco',  gender: 'Male',   preview_image_url: 'https://files2.heygen.ai/avatar/v3/Marco_public_3_20240108/full/2.2/preview_target.webp',        is_public: true, accent: ['#FFB997', '#843B62'] },
  { avatar_id: 'Bryan_FitnessCoach_public',      avatar_name: 'Bryan',  gender: 'Male',   preview_image_url: 'https://files2.heygen.ai/avatar/v3/Bryan_FitnessCoach_public/full/2.2/preview_target.webp',      is_public: true, accent: ['#FBD3E9', '#BB377D'] },
]

function proxyUrl(url: string): string {
  if (!url) return ''
  return `/api/ugc/avatar-image?url=${encodeURIComponent(url)}`
}

interface HeyGenApiAvatar {
  avatar_id: string
  avatar_name?: string
  gender?: string
  preview_image_url?: string
  preview_video_url?: string
}

// Ask HeyGen for their current public avatar library. Cached 24h via Next fetch — only one
// upstream call per day per region; subsequent requests are instant.
async function fetchHeyGenAvatars(): Promise<HeyGenApiAvatar[]> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': apiKey },
      next: { revalidate: 300 }, // 5 min while iterating; raise back to 86400 once stable
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.data?.avatars ?? []) as HeyGenApiAvatar[]
  } catch {
    return []
  }
}

// Build the avatar list shown in the picker. Strategy: keep curated IDs that HeyGen confirms
// are still alive (real photo URL), and for any dead curated slot pull a real public avatar
// from HeyGen's response to fill the gap — so the picker always shows 12 tiles with photos.
function buildAvatarList(heygenAvatars: HeyGenApiAvatar[]): HeyGenAvatar[] {
  const heygenById = new Map(heygenAvatars.map(a => [a.avatar_id, a]))
  const usedIds = new Set<string>()
  const usedFirstNames = new Set<string>()

  // Normalize avatar name to its first token (e.g. "Aditya_public_4" → "aditya") so we can
  // dedupe substitutes — picking 4x Aditya tiles is worse than picking 1x Aditya + 3x others.
  const firstName = (a: HeyGenApiAvatar): string =>
    (a.avatar_name ?? a.avatar_id).split(/[_\-\s]/)[0].toLowerCase()

  // Pool of HeyGen avatars with non-empty preview images, not already in our curated list,
  // ready to substitute for dead curated slots.
  const substitutes = heygenAvatars
    .filter(a => a.preview_image_url && a.preview_image_url.length > 10)
    .filter(a => !CURATED_AVATARS.some(c => c.avatar_id === a.avatar_id))

  // Seed used names from curated entries that are alive so substitutes don't collide with them
  for (const c of CURATED_AVATARS) {
    const live = heygenById.get(c.avatar_id)
    if (live?.preview_image_url) usedFirstNames.add(c.avatar_name.toLowerCase())
  }

  const nextSubstitute = (preferGender?: string): HeyGenApiAvatar | undefined => {
    const isCandidate = (a: HeyGenApiAvatar, requireGender: boolean): boolean => {
      if (usedIds.has(a.avatar_id)) return false
      if (usedFirstNames.has(firstName(a))) return false
      if (requireGender && preferGender && (a.gender ?? '').toLowerCase() !== preferGender.toLowerCase()) return false
      return true
    }
    // 1st pass: gender-matched + unique name; 2nd pass: any unique name; 3rd: anything unused
    let found = substitutes.find(a => isCandidate(a, true))
    if (!found) found = substitutes.find(a => isCandidate(a, false))
    if (!found) found = substitutes.find(a => !usedIds.has(a.avatar_id))
    return found
  }

  const result: HeyGenAvatar[] = []
  for (const curated of CURATED_AVATARS) {
    const live = heygenById.get(curated.avatar_id)
    const alive = live?.preview_image_url && live.preview_image_url.length > 10
    if (alive) {
      usedIds.add(curated.avatar_id)
      result.push({
        ...curated,
        preview_image_url: proxyUrl(live!.preview_image_url!),
        preview_video_url: live!.preview_video_url,
      })
      continue
    }
    // Curated ID is dead in HeyGen's current library — substitute
    const sub = nextSubstitute(curated.gender)
    if (sub) {
      usedIds.add(sub.avatar_id)
      usedFirstNames.add(firstName(sub))
      result.push({
        avatar_id: sub.avatar_id,
        avatar_name: (sub.avatar_name ?? '').split(/[_\-\s]/)[0] || curated.avatar_name,
        gender: sub.gender ?? curated.gender,
        preview_image_url: proxyUrl(sub.preview_image_url!),
        preview_video_url: sub.preview_video_url,
        is_public: true,
        accent: curated.accent, // keep the gradient identity
      })
    } else {
      // No substitutes left — keep the curated tile, gradient fallback will render
      result.push({ ...curated, preview_image_url: proxyUrl(curated.preview_image_url) })
    }
  }

  return result
}

export async function GET() {
  const heygenAvatars = await fetchHeyGenAvatars()
  const avatars = heygenAvatars.length > 0
    ? buildAvatarList(heygenAvatars)
    : CURATED_AVATARS.map(a => ({ ...a, preview_image_url: proxyUrl(a.preview_image_url) }))

  const publicWithImage = heygenAvatars.filter(a => a.preview_image_url && a.preview_image_url.length > 10).length

  return NextResponse.json(
    {
      avatars,
      source: heygenAvatars.length > 0 ? 'heygen+curated' : 'curated',
      _debug: {
        heygenTotal: heygenAvatars.length,
        heygenPublicWithImage: publicWithImage,
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
  )
}
