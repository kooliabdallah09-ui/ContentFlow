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

// Ask HeyGen for their CURRENT preview URLs. Cached 24h via Next fetch — only one upstream
// call per day per region; subsequent requests are instant. If the call fails or our curated
// IDs aren't in the response, we fall back to the hardcoded URLs (which the AvatarPicker's
// gradient tile handles gracefully if they also fail).
async function fetchHeyGenPreviewMap(): Promise<Map<string, { image?: string; video?: string }>> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return new Map()

  try {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': apiKey },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return new Map()
    const data = await res.json()
    const list: Array<{ avatar_id: string; preview_image_url?: string; preview_video_url?: string }> =
      data?.data?.avatars ?? []
    const map = new Map<string, { image?: string; video?: string }>()
    for (const a of list) {
      if (a.avatar_id) map.set(a.avatar_id, { image: a.preview_image_url, video: a.preview_video_url })
    }
    return map
  } catch {
    return new Map()
  }
}

export async function GET() {
  const heygenMap = await fetchHeyGenPreviewMap()

  const avatars = CURATED_AVATARS.map(a => {
    const live = heygenMap.get(a.avatar_id)
    const imageUrl = live?.image || a.preview_image_url
    return {
      ...a,
      preview_image_url: proxyUrl(imageUrl),
      preview_video_url: live?.video,
    }
  })

  return NextResponse.json(
    { avatars, source: heygenMap.size > 0 ? 'heygen+curated' : 'curated' },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  )
}
