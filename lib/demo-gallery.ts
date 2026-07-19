// Curated "Made with ContentFlow" showcase — shown on the landing page and
// inside the UGC generator. Upload files to the public `ugc-assets/demo/`
// folder in Supabase storage and list them here (best renders only).
export interface DemoVideo {
  src: string
  label: string
  tag: string
}

export const DEMO_VIDEOS: DemoVideo[] = [
  // { src: 'https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/….mp4', label: 'Skincare UGC ad', tag: 'UGC' },
]
