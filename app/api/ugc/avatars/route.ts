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

// Cycle through a tasteful gradient palette for non-curated tiles so each avatar still has
// a distinct visual identity even when its preview image fails to load.
const PALETTE: Array<[string, string]> = [
  ['#F8C9D2', '#D87DA1'], ['#FFD3A5', '#FD9853'], ['#D6B4FC', '#7E5BEF'], ['#A0E7E5', '#3DB6B0'],
  ['#FFAFBD', '#FFC371'], ['#83C5BE', '#006D77'], ['#8FA5C9', '#3B5481'], ['#B8C5A7', '#5E7C4F'],
  ['#FFCC70', '#C06C84'], ['#E0BBE4', '#957DAD'], ['#FFB997', '#843B62'], ['#FBD3E9', '#BB377D'],
]

// Build the full avatar list shown in the picker. Strategy:
//   1. Curated IDs first (in their hand-picked order) — known-good for ContentFlow's pipeline.
//   2. Then all of HeyGen's public avatars with a real preview image, deduped by first-name
//      token so the user doesn't see 6x "Aditya" variants of the same person.
// The picker provides search + filter, so showing hundreds is fine — the user finds by name.
function buildAvatarList(heygenAvatars: HeyGenApiAvatar[]): HeyGenAvatar[] {
  const heygenById = new Map(heygenAvatars.map(a => [a.avatar_id, a]))
  const usedIds = new Set<string>()
  const usedFirstNames = new Set<string>()

  const firstName = (a: { avatar_name?: string; avatar_id: string }): string =>
    (a.avatar_name ?? a.avatar_id).split(/[_\-\s]/)[0].toLowerCase()

  const result: HeyGenAvatar[] = []

  // 1) Curated entries that are still alive in HeyGen's library
  for (const curated of CURATED_AVATARS) {
    const live = heygenById.get(curated.avatar_id)
    const alive = live?.preview_image_url && live.preview_image_url.length > 10
    if (!alive) continue
    usedIds.add(curated.avatar_id)
    usedFirstNames.add(curated.avatar_name.toLowerCase())
    result.push({
      ...curated,
      preview_image_url: proxyUrl(live!.preview_image_url!),
      preview_video_url: live!.preview_video_url,
    })
  }

  // 2) All other HeyGen public avatars with images, deduped by first-name token
  for (const a of heygenAvatars) {
    if (!a.preview_image_url || a.preview_image_url.length <= 10) continue
    if (usedIds.has(a.avatar_id)) continue
    const fn = firstName(a)
    if (usedFirstNames.has(fn)) continue
    usedIds.add(a.avatar_id)
    usedFirstNames.add(fn)
    const [c1, c2] = PALETTE[result.length % PALETTE.length]
    const cleanName = (a.avatar_name ?? '').split(/[_\-\s]/)[0] || a.avatar_id.slice(0, 12)
    result.push({
      avatar_id: a.avatar_id,
      avatar_name: cleanName,
      gender: a.gender || 'Unknown',
      preview_image_url: proxyUrl(a.preview_image_url),
      preview_video_url: a.preview_video_url,
      is_public: true,
      accent: [c1, c2],
    })
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
