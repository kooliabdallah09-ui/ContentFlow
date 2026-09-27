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
  style: 'bold-white' | 'minimal' | 'caption' | 'tiktok' | 'outline' | 'highlight' | 'bubble'
  x?: number           // 0–1, 0=left edge, 1=right edge (free positioning)
  y?: number           // 0–1, 0=top edge, 1=bottom edge
  color?: string       // hex e.g. '#ffffff'
  fontSize?: 'sm' | 'md' | 'lg' | 'xl'
  animation?: 'none' | 'fade' | 'slide-up' | 'zoom' | 'typewriter'
  captionStyle?: 'default' | 'tiktok' | 'outline' | 'highlight' | 'bubble'
  strokeColor?: string   // text outline color (for tiktok/outline styles)
  bgColor?: string       // background override
  fontFamily?: 'sans' | 'rounded' | 'mono' | 'serif'
}

// B-roll: a second video drawn over the main one for a timed window while
// the main audio (voiceover) keeps playing. 'full' = cut-away covering the
// whole frame, 'pip' = picture-in-picture corner card.
export interface VideoOverlay {
  id: string
  src: string          // blob URL (uploaded) or remote URL
  label: string
  start: number        // seconds on the main timeline
  duration: number     // seconds shown
  clipOffset: number   // seconds into the b-roll source to start from
  mode: 'full' | 'pip'
  sourceDuration: number
}

export interface MusicTrack {
  url: string
  label: string
  volume: number       // 0–1
  startOffset?: number // seconds into the audio file to start from
}

export interface EditSpec {
  videoUrl: string     // original Kling/Sora output URL
  duration: number     // total video duration in seconds
  trimStart: number    // seconds from start to cut in
  trimEnd: number      // seconds from start to cut out (0 = use full duration)
  overlays: TextOverlay[]
  imageOverlays: ImageOverlay[]
  videoOverlays?: VideoOverlay[]
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
    preset: 'none' | 'bw' | 'vintage' | 'vivid' | 'cinema' | 'muted' | 'warm' | 'cool' | 'fade' | 'punch'
  }
  zoom?: {
    fromScale: number  // e.g. 1.0
    toScale: number    // e.g. 1.3
    fromX: number      // 0-1 pan origin
    fromY: number
    toX: number
    toY: number
  }
  crop?: { x: number; y: number; w: number; h: number }  // normalized 0-1
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

// Mixkit, free for commercial use with no attribution (Mixkit Stock Music
// Free License). These replaced Pixabay links, which Pixabay now answers with
// 403 when hotlinked.
export const MUSIC_LIBRARY: MusicTrack[] = [
  { url: 'https://assets.mixkit.co/music/763/763.mp3', label: 'Chill Lo-fi', volume: 0.25 },
  { url: 'https://assets.mixkit.co/music/5/5.mp3', label: 'Upbeat Pop', volume: 0.25 },
  { url: 'https://assets.mixkit.co/music/1012/1012.mp3', label: 'Motivational', volume: 0.25 },
  { url: 'https://assets.mixkit.co/music/127/127.mp3', label: 'Ambient Drift', volume: 0.25 },
  { url: 'https://assets.mixkit.co/music/562/562.mp3', label: 'Cinematic Rise', volume: 0.25 },
  { url: 'https://assets.mixkit.co/music/738/738.mp3', label: 'Vlog Beat', volume: 0.25 },
]
