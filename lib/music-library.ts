export type MusicMood = 'upbeat' | 'chill' | 'dramatic' | 'energetic'

export interface MusicTrack {
  mood: MusicMood
  label: string
  emoji: string
  url: string
  volume: number
}

// Royalty-free tracks from Mixkit (free for commercial use, no attribution required)
export const MUSIC_TRACKS: Record<MusicMood, MusicTrack> = {
  upbeat: {
    mood: 'upbeat',
    label: 'Upbeat',
    emoji: '🎵',
    url: 'https://cdn.assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
    volume: 0.35,
  },
  chill: {
    mood: 'chill',
    label: 'Chill',
    emoji: '🌊',
    url: 'https://cdn.assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
    volume: 0.3,
  },
  dramatic: {
    mood: 'dramatic',
    label: 'Dramatic',
    emoji: '🎬',
    url: 'https://cdn.assets.mixkit.co/music/preview/mixkit-cinematic-fantasy-562.mp3',
    volume: 0.3,
  },
  energetic: {
    mood: 'energetic',
    label: 'Energetic',
    emoji: '⚡',
    url: 'https://cdn.assets.mixkit.co/music/preview/mixkit-games-worldbeat-466.mp3',
    volume: 0.35,
  },
}

export function getMusicTrack(mood: MusicMood | null | undefined): MusicTrack | null {
  if (!mood) return null
  return MUSIC_TRACKS[mood] ?? null
}
