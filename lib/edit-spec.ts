export interface ImageOverlay {
  id: string
  src: string       // public URL or blob URL
  start: number     // seconds
  duration: number  // seconds
  x: number         // 0–1
  y: number         // 0–1
  scale: number     // 0.05–1, fraction of video width
  opacity: number   // 0–1
}

export interface TextOverlay {
  id: string
  text: string
  start: number        // seconds
  duration: number     // seconds
  position: 'top' | 'center' | 'bottom'
  style: 'bold-white' | 'minimal' | 'caption'
  x?: number           // 0–1, 0=left edge, 1=right edge (free positioning)
  y?: number           // 0–1, 0=top edge, 1=bottom edge
  color?: string       // hex e.g. '#ffffff'
  fontSize?: 'sm' | 'md' | 'lg' | 'xl'
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
  imageOverlays: ImageOverlay[]
  music?: MusicTrack
  aspectRatio: '9:16' | '1:1' | '16:9'
  volume?: number      // 0–1, original video audio (default 1)
  speed?: number       // 0.25–4 (default 1)
  fadeIn?: boolean
  fadeOut?: boolean
  filters?: {
    brightness: number   // 0–2, default 1
    contrast: number     // 0–2, default 1
    saturation: number   // 0–2, default 1
    preset: 'none' | 'bw' | 'vintage' | 'vivid' | 'cinema' | 'muted'
  }
}

export const DEFAULT_FILTERS = { brightness: 1, contrast: 1, saturation: 1, preset: 'none' as const }

export const EMPTY_EDIT_SPEC: EditSpec = {
  videoUrl: '',
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
  overlays: [],
  imageOverlays: [],
  music: undefined,
  aspectRatio: '9:16',
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  { url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_270f42fe9d.mp3', label: 'Chill Lo-fi', volume: 0.25 },
  { url: 'https://cdn.pixabay.com/download/audio/2023/06/08/audio_58c1e76847.mp3', label: 'Upbeat Pop', volume: 0.25 },
  { url: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_943d4f9d08.mp3', label: 'Motivational', volume: 0.25 },
]
