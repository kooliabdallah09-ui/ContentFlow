export type MusicMood = 'upbeat' | 'chill' | 'dramatic' | 'energetic'

export interface MusicTrack {
  mood: MusicMood
  label: string
  emoji: string
  url: string
  volume: number
}

// Royalty-free tracks from Mixkit (free for commercial use, no attribution required).
// Mixkit retired its cdn.assets.mixkit.co host in 2026; files now live at
// assets.mixkit.co/music/<id>/<id>.mp3 (served with CORS *).
export const MUSIC_TRACKS: Record<MusicMood, MusicTrack> = {
  upbeat: {
    mood: 'upbeat',
    label: 'Upbeat',
    emoji: '🎵',
    url: 'https://assets.mixkit.co/music/130/130.mp3',
    volume: 0.35,
  },
  chill: {
    mood: 'chill',
    label: 'Chill',
    emoji: '🌊',
    url: 'https://assets.mixkit.co/music/443/443.mp3',
    volume: 0.3,
  },
  dramatic: {
    mood: 'dramatic',
    label: 'Dramatic',
    emoji: '🎬',
    url: 'https://assets.mixkit.co/music/562/562.mp3',
    volume: 0.3,
  },
  energetic: {
    mood: 'energetic',
    label: 'Energetic',
    emoji: '⚡',
    url: 'https://assets.mixkit.co/music/466/466.mp3',
    volume: 0.35,
  },
}

export function getMusicTrack(mood: MusicMood | null | undefined): MusicTrack | null {
  if (!mood) return null
  return MUSIC_TRACKS[mood] ?? null
}
