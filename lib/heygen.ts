const HEYGEN_API_BASE = 'https://api.heygen.com'

export const HEYGEN_VOICES = [
  { id: '1bd001e7e50f421d891986aad5158bc8', name: 'Sofia', accent: 'American Female' },
  { id: '2d5b0e6cf36f460aa7fc47e3eee4ba54', name: 'James', accent: 'American Male' },
  { id: 'e749e866b30d47e4858cac12a6d13f2f', name: 'Emma', accent: 'British Female' },
  { id: '1588bf4c1db74e1dbba1c7b2e9f54b14', name: 'Oliver', accent: 'British Male' },
]

export const DEFAULT_VOICE_ID = HEYGEN_VOICES[0].id

// Pick a HeyGen fallback voice that matches the avatar's gender.
// Used when ElevenLabs fails — never serve a female voice on a male avatar (or vice versa).
// Handles every gender string shape HeyGen / the picker might pass: 'male', 'Male', 'M',
// 'man', 'Man', 'masculine', etc.
export function fallbackVoiceForGender(gender?: string): string {
  const g = (gender ?? '').toLowerCase().trim()
  const MALE = '2d5b0e6cf36f460aa7fc47e3eee4ba54'   // James
  const FEMALE = '1bd001e7e50f421d891986aad5158bc8' // Sofia
  if (g.startsWith('m')) return MALE       // male, man, masculine, m
  if (g.startsWith('f') || g.startsWith('w')) return FEMALE // female, f, woman, w
  return FEMALE // unknown — bias to neutral default
}

// Hand-maintained gender map for stock avatars whose ID encodes the name. Used when
// the picker doesn't pass a gender (server-only generation) or when HeyGen's API returns
// 'Unknown' / empty for an avatar we know about.
const KNOWN_AVATAR_GENDERS: Record<string, 'Male' | 'Female'> = {
  'Daisy-inskirt-20220818': 'Female',
  'Eric_public_pro2_20230608': 'Male',
  'Susan_public_2_20240328': 'Female',
  'Tyler-incasualsuit-20220721': 'Male',
  'Anna_public_3_20240108': 'Female',
  'Shawn_public_3_20231116': 'Male',
  'Grace-inblackskirt-20220820': 'Female',
  'Noah_public_3_20240111': 'Male',
  'Monica_inwhitedress_20240131': 'Female',
  'Wayne_20240711': 'Male',
  'Marco_public_3_20240108': 'Male',
  'Bryan_FitnessCoach_public': 'Male',
}

// Common English first names by gender — last-resort inference when the avatar ID
// looks like 'Bryan_FitnessCoach_public' or 'Anna_public_3_…' and HeyGen says nothing.
const MALE_NAMES = new Set([
  'eric','tyler','shawn','noah','wayne','marco','bryan','liam','noah','ethan','mason',
  'james','john','michael','william','david','richard','joseph','thomas','charles',
  'aditya','rahul','arjun','wei','jin','kenji','hiroshi','diego','carlos','luis',
  'ahmed','mohammed','omar','ali','samuel','daniel','matthew','andrew','joshua','ryan',
])
const FEMALE_NAMES = new Set([
  'daisy','susan','anna','grace','monica','olivia','emma','ava','sophia','isabella',
  'mia','charlotte','amelia','harper','evelyn','abigail','emily','elizabeth','sofia',
  'avery','ella','scarlett','priya','aisha','fatima','yuki','sakura','maria','lucia',
  'aaliyah','zara','hope','susan','rachel','sarah','jessica','jennifer','laura',
])

function nameFromAvatarId(avatarId: string): string {
  return avatarId.split(/[_\-\s]/)[0].toLowerCase()
}

export function inferAvatarGender(avatarId?: string): 'Male' | 'Female' | undefined {
  if (!avatarId) return undefined
  if (KNOWN_AVATAR_GENDERS[avatarId]) return KNOWN_AVATAR_GENDERS[avatarId]
  const first = nameFromAvatarId(avatarId)
  if (MALE_NAMES.has(first)) return 'Male'
  if (FEMALE_NAMES.has(first)) return 'Female'
  return undefined
}

// Submit a video generation job — returns video_id immediately (async, not the final URL)
// If audioUrl is provided, uses voice type 'audio' so HeyGen lip-syncs to your ElevenLabs track.
export async function submitVideoJob(
  script: string,
  avatarId: string,
  voiceId: string = DEFAULT_VOICE_ID,
  backgroundImageUrl?: string,
  audioUrl?: string,
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')
  if (!script?.trim()) throw new Error('Script cannot be empty')
  if (script.length > 3000) throw new Error('Script exceeds maximum length of 3000 characters')

  const background = backgroundImageUrl
    ? { type: 'image', url: backgroundImageUrl }
    : { type: 'color', value: '#F2EDE8' } // warm off-white — better than stark white

  const voice = audioUrl
    ? { type: 'audio', audio_url: audioUrl }
    : { type: 'text', input_text: script, voice_id: voiceId }

  const res = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
          voice,
          background,
        },
      ],
      dimension: { width: 1080, height: 1920 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error?.message || `HeyGen error: ${res.statusText}`)
  }

  const data = await res.json()
  const videoId = data?.data?.video_id
  if (!videoId) throw new Error('HeyGen did not return a video ID')

  return { videoId }
}

// Poll video status — supports both /v3/videos (new) and /v1/video_status.get (legacy)
export async function getVideoStatus(videoId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  duration?: number
}> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')

  // Try v3 first
  const v3Res = await fetch(`${HEYGEN_API_BASE}/v3/videos/${videoId}`, {
    headers: { 'X-Api-Key': apiKey },
  })

  if (v3Res.ok) {
    const data = await v3Res.json()
    const status = data?.data?.status ?? data?.status
    return {
      status: status === 'completed' ? 'completed'
        : status === 'failed' ? 'failed'
        : status === 'processing' ? 'processing'
        : 'pending',
      videoUrl: data?.data?.video_url ?? data?.video_url ?? undefined,
      duration: data?.data?.duration ?? undefined,
    }
  }

  // Fallback to v1 for legacy avatar videos
  const res = await fetch(`${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': apiKey },
  })

  if (!res.ok) throw new Error(`Failed to get video status: ${res.statusText}`)

  const data = await res.json()
  const status = data?.data?.status

  return {
    status: status === 'completed' ? 'completed'
      : status === 'failed' ? 'failed'
      : status === 'processing' ? 'processing'
      : 'pending',
    videoUrl: data?.data?.video_url ?? undefined,
    duration: data?.data?.duration ?? undefined,
  }
}

export function estimateDuration(script: string): number {
  return Math.ceil((script.split(/\s+/).length / 150) * 60)
}

// Create a Photo Avatar from an image URL — unlocks motion_prompt + expressiveness in video generation
// Returns the avatar_id to use with submitAvatarVideoJob
export async function createPhotoAvatar(imageUrl: string, name?: string): Promise<{ avatarId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')

  const res = await fetch(`${HEYGEN_API_BASE}/v3/avatars`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'photo',
      name: name ?? `ugc-${Date.now()}`,
      file: { type: 'url', url: imageUrl },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error?.message || `HeyGen photo avatar error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const avatarId =
    data?.data?.avatar_item?.id ??
    data?.data?.id ??
    data?.avatar_item?.id ??
    data?.avatar_id ??
    data?.id
  if (!avatarId) throw new Error(`HeyGen did not return an avatar ID. Response: ${JSON.stringify(data)}`)

  return { avatarId }
}

// Submit an Avatar IV video using a Photo Avatar id — supports motion_prompt + expressiveness for natural body motion
export async function submitAvatarVideoJob(
  script: string,
  avatarId: string,
  voiceId: string = DEFAULT_VOICE_ID,
  audioUrl?: string,
  motionPrompt?: string,
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')
  if (!script?.trim()) throw new Error('Script cannot be empty')

  const body: Record<string, unknown> = {
    type: 'avatar',
    avatar_id: avatarId,
    resolution: '1080p',
    aspect_ratio: '9:16',
    expressiveness: 'high',
  }

  if (motionPrompt) body.motion_prompt = motionPrompt

  if (audioUrl) {
    body.audio_url = audioUrl
  } else {
    body.script = script
    body.voice_id = voiceId
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v3/videos`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error?.message || `HeyGen avatar video error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const videoId = data?.data?.video_id ?? data?.video_id
  if (!videoId) throw new Error(`HeyGen did not return a video ID. Response: ${JSON.stringify(data)}`)

  return { videoId }
}

// Submit a video job using a static image — animates the image directly via /v3/videos
export async function submitImageToVideoJob(
  script: string,
  imageUrl: string,
  voiceId: string = DEFAULT_VOICE_ID,
  audioUrl?: string,
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')
  if (!script?.trim()) throw new Error('Script cannot be empty')

  const body: Record<string, unknown> = {
    type: 'image',
    image: { type: 'url', url: imageUrl },
    resolution: '1080p',
    aspect_ratio: '9:16',
    expressiveness: 'high',
  }

  if (audioUrl) {
    body.audio_url = audioUrl
  } else {
    body.script = script
    body.voice_id = voiceId
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v3/videos`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error?.message || `HeyGen image-to-video error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const videoId = data?.data?.video_id ?? data?.video_id
  if (!videoId) throw new Error(`HeyGen did not return a video ID. Response: ${JSON.stringify(data)}`)

  return { videoId }
}
