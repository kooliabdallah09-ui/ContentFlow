// Browser-side image compressor. Raw phone-camera JPEGs are 5-15 MB, well
// over Vercel's 4.5 MB request-body limit for our generate endpoints. This
// downscales to a max long-edge and re-encodes as JPEG so uploads fit
// safely in a single JSON request. Runs entirely in the browser via
// canvas.toDataURL — no server round-trip.

'use client'

export interface CompressedImage {
  base64: string
  mimeType: string
  preview: string
}

export async function compressImageFile(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<CompressedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('image decode failed'))
    i.src = dataUrl
  })
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  const outUrl = canvas.toDataURL('image/jpeg', quality)
  const [header, base64] = outUrl.split(',')
  const mimeType = header.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg'
  return { base64, mimeType, preview: outUrl }
}
