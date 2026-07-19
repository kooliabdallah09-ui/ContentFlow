// Curated "Made with ContentFlow" showcase — shown on the landing page.
// Files live in the public `ugc-assets/demo/` storage folder.
export interface DemoItem {
  src: string
  label: string
  tag: string
  type: 'video' | 'image'
}

const BASE = 'https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo'

export const DEMO_VIDEOS: DemoItem[] = [
  { src: `${BASE}/ugc-1.mp4`, label: 'UGC product ad', tag: 'UGC', type: 'video' },
  { src: `${BASE}/influencer-1.png`, label: 'AI influencer — night out', tag: 'INFLUENCER', type: 'image' },
  { src: `${BASE}/product-1.png`, label: 'Product shot — mid-air', tag: 'PRODUCT', type: 'image' },
  { src: `${BASE}/ugc-2.mp4`, label: 'Talking-head UGC', tag: 'UGC', type: 'video' },
  { src: `${BASE}/influencer-2.png`, label: 'AI influencer — candid', tag: 'INFLUENCER', type: 'image' },
  { src: `${BASE}/product-2.png`, label: 'Product shot — linen flat lay', tag: 'PRODUCT', type: 'image' },
  { src: `${BASE}/ugc-3.mp4`, label: 'Creator review', tag: 'UGC', type: 'video' },
  { src: `${BASE}/influencer-3.png`, label: 'AI influencer — market', tag: 'INFLUENCER', type: 'image' },
  { src: `${BASE}/product-3.png`, label: 'Product shot — hard light', tag: 'PRODUCT', type: 'image' },
  { src: `${BASE}/cinemotion-carthys.mp4`, label: 'CineMotion product ad', tag: 'CINEMOTION', type: 'video' },
  { src: `${BASE}/product-4.png`, label: 'Product shot — studio drop', tag: 'PRODUCT', type: 'image' },
]
