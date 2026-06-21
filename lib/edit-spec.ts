export interface TextOverlay {
  id: string
  text: string
  start: number        // seconds
  duration: number     // seconds
  position: 'top' | 'center' | 'bottom'
  style: 'bold-white' | 'minimal' | 'caption'
}

export interface MusicTrack {
  url: string
  label: string
  volume: number       // 0–1
}

export interface EditSpec {
  videoUrl: string     // original Kling/Sora output URL
  duration: number     // total video duration in seconds
  trimStart: number    // seconds from start to cut in
  trimEnd: number      // seconds from start to cut out (0 = use full duration)
  overlays: TextOverlay[]
  music?: MusicTrack
  aspectRatio: '9:16' | '1:1' | '16:9'
}

export const EMPTY_EDIT_SPEC: EditSpec = {
  videoUrl: '',
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
  overlays: [],
  music: undefined,
  aspectRatio: '9:16',
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  { url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_270f42fe9d.mp3', label: 'Chill Lo-fi', volume: 0.25 },
  { url: 'https://cdn.pixabay.com/download/audio/2023/06/08/audio_58c1e76847.mp3', label: 'Upbeat Pop', volume: 0.25 },
  { url: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_943d4f9d08.mp3', label: 'Motivational', volume: 0.25 },
]
