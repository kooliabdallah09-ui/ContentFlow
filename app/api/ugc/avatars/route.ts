import { NextResponse } from 'next/server'

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url?: string
  is_public: boolean
}

// Curated fallback avatars using real HeyGen stock avatar IDs
// These are public HeyGen avatars — update if HeyGen changes their library
const FALLBACK_AVATARS: HeyGenAvatar[] = [
  {
    avatar_id: 'Daisy-inskirt-20220818',
    avatar_name: 'Daisy',
    gender: 'Female',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Daisy-inskirt-20220818/preview_target.webp',
    is_public: true,
  },
  {
    avatar_id: 'Eric_public_pro2_20230608',
    avatar_name: 'Eric',
    gender: 'Male',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Eric_public_pro2_20230608/preview_target.webp',
    is_public: true,
  },
  {
    avatar_id: 'Susan_public_2_20240328',
    avatar_name: 'Susan',
    gender: 'Female',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Susan_public_2_20240328/preview_target.webp',
    is_public: true,
  },
  {
    avatar_id: 'Tyler-incasualsuit-20220721',
    avatar_name: 'Tyler',
    gender: 'Male',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Tyler-incasualsuit-20220721/preview_target.webp',
    is_public: true,
  },
  {
    avatar_id: 'Anna_public_3_20240108',
    avatar_name: 'Anna',
    gender: 'Female',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Anna_public_3_20240108/preview_target.webp',
    is_public: true,
  },
  {
    avatar_id: 'Shawn_public_3_20231116',
    avatar_name: 'Shawn',
    gender: 'Male',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Shawn_public_3_20231116/preview_target.webp',
    is_public: true,
  },
  {
    avatar_id: 'Grace-inblackskirt-20220820',
    avatar_name: 'Grace',
    gender: 'Female',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Grace-inblackskirt-20220820/preview_target.webp',
    is_public: true,
  },
  {
    avatar_id: 'Noah_public_3_20240111',
    avatar_name: 'Noah',
    gender: 'Male',
    preview_image_url: 'https://files.heygen.ai/avatar/v3/Noah_public_3_20240111/preview_target.webp',
    is_public: true,
  },
]

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY

  // No key — return curated fallbacks so the UI still works
  if (!apiKey) {
    return NextResponse.json({ avatars: FALLBACK_AVATARS, source: 'fallback' })
  }

  try {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': apiKey },
      next: { revalidate: 3600 }, // cache for 1 hour
    })

    if (!res.ok) {
      console.error('HeyGen avatars API error:', res.status)
      return NextResponse.json({ avatars: FALLBACK_AVATARS, source: 'fallback' })
    }

    const data = await res.json()
    const avatars: HeyGenAvatar[] = (data?.data?.avatars ?? [])
      .filter((a: HeyGenAvatar) => a.is_public && a.preview_image_url)
      .slice(0, 24) // cap at 24 to keep the UI manageable

    if (!avatars.length) {
      return NextResponse.json({ avatars: FALLBACK_AVATARS, source: 'fallback' })
    }

    return NextResponse.json({ avatars, source: 'heygen' })
  } catch (err) {
    console.error('Failed to fetch HeyGen avatars:', err)
    return NextResponse.json({ avatars: FALLBACK_AVATARS, source: 'fallback' })
  }
}
