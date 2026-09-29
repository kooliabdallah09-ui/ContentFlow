// Music and tones for motion ads.
//
// Tracks are Mixkit (Mixkit Stock Music Free License: free for commercial
// use, no attribution), fetched straight from assets.mixkit.co, which serves
// them with CORS *. Beat grids were computed once with librosa (the
// analyze_music_cues.py approach from latent-spaces/brag) and are stored
// here as frames at 30fps over the first 20s of the ad, counted from
// `offset` (seconds into the file where the ad's music starts; Cinematic
// Fantasy has a 15s beatless intro). `accents` are the strongest hits —
// good spots for reveals and payoffs.

export type MotionTrack = {
  key: string
  title: string
  url: string
  bpm: number
  offset: number
  beats: number[]
  accents: number[]
}

export const MOTION_TRACKS: MotionTrack[] = [
  { key: 'happy-times', title: 'Happy Times', url: 'https://assets.mixkit.co/music/158/158.mp3', bpm: 120, offset: 0.0,
    beats: [1, 16, 32, 46, 61, 76, 92, 106, 122, 137, 152, 166, 181, 196, 211, 226, 241, 256, 272, 286, 302, 316, 332, 347, 362, 377, 391, 406, 421, 436, 451, 466, 482, 496, 512, 526, 542, 556, 572, 587],
    accents: [99, 133, 193, 279, 286, 332, 347, 362, 373, 391, 403, 421, 436, 542, 572] },
  { key: 'feeling-happy', title: 'Feeling Happy', url: 'https://assets.mixkit.co/music/5/5.mp3', bpm: 162, offset: 0.0,
    beats: [17, 28, 40, 51, 62, 74, 85, 96, 108, 119, 130, 141, 152, 164, 174, 186, 197, 209, 220, 231, 242, 254, 265, 276, 287, 299, 310, 321, 332, 344, 355, 366, 378, 389, 400, 411, 422, 434, 445, 456, 467, 479, 490, 501, 512, 523, 535, 546, 557, 569, 580, 591],
    accents: [174, 265, 287, 299, 411, 422] },
  { key: 'funkee-monkeee', title: 'Funkee Monkeee', url: 'https://assets.mixkit.co/music/1140/1140.mp3', bpm: 120, offset: 0.0,
    beats: [23, 38, 53, 68, 83, 98, 113, 128, 143, 158, 173, 188, 203, 218, 233, 248, 263, 278, 293, 308, 323, 338, 353, 368, 383, 398, 413, 428, 443, 458, 473, 488, 503, 518, 533, 548, 563, 578, 593],
    accents: [150, 165, 203, 256, 285, 331, 353, 360, 390, 420, 465, 496, 563] },
  { key: 'tech-house-vibes', title: 'Tech House Vibes', url: 'https://assets.mixkit.co/music/130/130.mp3', bpm: 123, offset: 0.0,
    beats: [2, 17, 32, 46, 61, 76, 91, 106, 120, 135, 149, 164, 179, 194, 209, 224, 238, 253, 267, 282, 297, 312, 327, 341, 356, 371, 386, 401, 415, 430, 445, 459, 474, 489, 504, 519, 533, 548, 563, 577, 592],
    accents: [504, 533, 563, 577] },
  { key: 'lofi-01', title: 'Lo-Fi 01', url: 'https://assets.mixkit.co/music/763/763.mp3', bpm: 99, offset: 0.0,
    beats: [4, 24, 38, 56, 74, 92, 112, 131, 150, 170, 187, 204, 222, 241, 260, 277, 296, 314, 332, 350, 369, 386, 404, 422, 440, 458, 474, 490, 506, 524, 540, 554, 569, 585],
    accents: [404, 410, 506, 530, 554, 578, 596] },
  { key: 'cinematic-fantasy', title: 'Cinematic Fantasy', url: 'https://assets.mixkit.co/music/562/562.mp3', bpm: 120, offset: 15.0,
    beats: [1, 16, 31, 45, 61, 75, 91, 106, 121, 135, 150, 165, 180, 195, 210, 225, 240, 255, 271, 285, 301, 316, 331, 346, 360, 375, 390, 405, 420, 435, 450, 465, 481, 496, 511, 526, 541, 556, 571, 585],
    accents: [31, 91, 135, 180, 210, 225, 271, 301, 375, 390, 481] },
]

export type MotionTone = 'playful' | 'polished' | 'app-store' | 'chaotic' | 'deadpan' | 'cinematic' | 'yc-parody'

// Tone presets, adapted from latent-spaces/brag. `direction` goes into the
// writer's brief; `track` is the default music for that tone.
export const MOTION_TONES: Record<MotionTone, { label: string; direction: string; track: string }> = {
  playful:     { label: 'Playful',     track: 'happy-times',       direction: 'Punchy, playful, clean. 4-5 scenes, quick pops, a joke that comes from the product itself.' },
  polished:    { label: 'Polished',    track: 'tech-house-vibes',  direction: 'Serious, elegant, restrained. 3-4 scenes with longer holds, soft entrances, very little text.' },
  'app-store': { label: 'App Store',   track: 'feeling-happy',     direction: 'Clean feature showcase. 4-6 scenes, one feature each, shown inside the app UI, smooth slides.' },
  chaotic:     { label: 'Chaotic',     track: 'funkee-monkeee',    direction: 'FAST and LOUD. 6-8 scenes, some under 2 seconds, ALL CAPS captions, shakes, bursts and punch zooms.' },
  deadpan:     { label: 'Deadpan',     track: 'lofi-01',           direction: 'Calm and dry; nothing is played as a joke. 3-4 scenes, big empty space, slow entrances, understatement.' },
  cinematic:   { label: 'Cinematic',   track: 'cinematic-fantasy', direction: 'Trailer-scale and epic. 4-5 scenes, huge type, dramatic reveals landing on the music accents.' },
  'yc-parody': { label: 'YC parody',   track: 'tech-house-vibes',  direction: 'A deadpan startup launch, played completely straight. 4-5 scenes, one grand claim each, hard cuts.' },
}

export function motionTrack(key: string | null | undefined): MotionTrack | null {
  return MOTION_TRACKS.find(t => t.key === key) ?? null
}

// Sound effects: Kenney (kenney.nl, CC0), converted to mp3 in public/motion-audio/sfx/.
export const SFX_NAMES = ['click', 'pop', 'switch', 'whoosh', 'tick', 'type', 'impact', 'bonk', 'success', 'bong', 'error', 'glitch'] as const
export type SfxName = typeof SFX_NAMES[number]
export const sfxUrl = (name: SfxName) => `/motion-audio/sfx/${name}.mp3`
