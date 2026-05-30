import { NextResponse } from 'next/server'

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url?: string
  is_public: boolean
}

// Known-good HeyGen stock avatar IDs with their CDN preview paths
const FALLBACK_AVATARS: HeyGenAvatar[] = [
  { avatar_id: 'Daisy-inskirt-20220818', avatar_name: 'Daisy', gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Daisy-inskirt-20220818/full/2.2/preview_target.webp', is_public: true },
  { avatar_id: 'Eric_public_pro2_20230608', avatar_name: 'Eric', gender: 'Male', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Eric_public_pro2_20230608/full/2.2/preview_target.webp', is_public: true },
  { avatar_id: 'Susan_public_2_20240328', avatar_name: 'Susan', gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Susan_public_2_20240328/full/2.2/preview_target.webp', is_public: true },
  { avatar_id: 'Tyler-incasualsuit-20220721', avatar_name: 'Tyler', gender: 'Male', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Tyler-incasualsuit-20220721/full/2.2/preview_target.webp', is_public: true },
  { avatar_id: 'Anna_public_3_20240108', avatar_name: 'Anna', gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Anna_public_3_20240108/full/2.2/preview_target.webp', is_public: true },
  { avatar_id: 'Shawn_public_3_20231116', avatar_name: 'Shawn', gender: 'Male', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Shawn_public_3_20231116/full/2.2/preview_target.webp', is_public: true },
  { avatar_id: 'Grace-inblackskirt-20220820', avatar_name: 'Grace', gender: 'Female', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Grace-inblackskirt-20220820/full/2.2/preview_target.webp', is_public: true },
  { avatar_id: 'Noah_public_3_20240111', avatar_name: 'Noah', gender: 'Male', preview_image_url: 'https://files2.heygen.ai/avatar/v3/Noah_public_3_20240111/full/2.2/preview_target.webp', is_public: true },
]

function proxyUrl(url: string): string {
  if (!url) return ''
  return `/api/ugc/avatar-image?url=${encodeURIComponent(url)}`
}

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      avatars: FALLBACK_AVATARS.map(a => ({ ...a, preview_image_url: proxyUrl(a.preview_image_url) })),
      source: 'fallback',
    })
  }

  try {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': apiKey },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({
        avatars: FALLBACK_AVATARS.map(a => ({ ...a, preview_image_url: proxyUrl(a.preview_image_url) })),
        source: 'fallback',
      })
    }

    const data = await res.json()
    const avatars: HeyGenAvatar[] = (data?.data?.avatars ?? [])
      .filter((a: HeyGenAvatar) => a.is_public)
      .slice(0, 24)
      .map((a: HeyGenAvatar) => ({
        ...a,
        preview_image_url: a.preview_image_url ? proxyUrl(a.preview_image_url) : '',
      }))

    if (!avatars.length) {
      return NextResponse.json({
        avatars: FALLBACK_AVATARS.map(a => ({ ...a, preview_image_url: proxyUrl(a.preview_image_url) })),
        source: 'fallback',
      })
    }

    return NextResponse.json({ avatars, source: 'heygen' })
  } catch {
    return NextResponse.json({
      avatars: FALLBACK_AVATARS.map(a => ({ ...a, preview_image_url: proxyUrl(a.preview_image_url) })),
      source: 'fallback',
    })
  }
}
