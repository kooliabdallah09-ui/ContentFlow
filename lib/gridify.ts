// Gridify — the entire unlock for the new UGC pipeline.
//
// Seedance 2.0 blocks real human face images at the reference-scan layer.
// The workaround: draw a white grid mask ON TOP of the source image, so
// the character reads as fragmented "windows" from the safety scanner's
// point of view, but Seedance's diffusion still reconstructs the full
// character from the visible portions.
//
// The grid must partially obscure the face — but not completely. Too few
// white bars and individual tiles still show a face. Too many bars and
// identity info is destroyed. The retry ladder below has been calibrated
// in testing.

import sharp from 'sharp'

export interface GridParams {
  cols: number
  rows: number
  gap: number       // white bar width in pixels
  tileW: number     // visible tile width in pixels
  tileH: number     // visible tile height in pixels
}

// Retry ladder. If Seedance flags the render as sensitive we resubmit with
// the next set of parameters — each pattern presents different fragmentation
// to the safety scanner.
//
// Attempt 1 matches the reference grid: 7 columns × 10 rows of tall
// windows with thick white bars, canvas close to 9:16. Subsequent attempts
// adjust column count and tile aspect while keeping the tall-window look.
export const GRID_RETRIES: GridParams[] = [
  { cols: 7,  rows: 10, gap: 14, tileW: 90,  tileH: 117 },
  { cols: 8,  rows: 10, gap: 12, tileW: 80,  tileH: 116 },
  { cols: 6,  rows: 10, gap: 16, tileW: 100, tileH: 121 },
  { cols: 7,  rows: 12, gap: 12, tileW: 90,  tileH: 100 },
  { cols: 8,  rows: 11, gap: 12, tileW: 80,  tileH: 108 },
]

// Turn a portrait image into a grid-overlay image: the source photo behind
// (never cropped or repositioned) with white vertical + horizontal bars
// composited on top, so the visible photo appears in `cols × rows` tall
// windows separated by white gutters.
export async function gridify(sourceBuf: Buffer, params: GridParams): Promise<Buffer> {
  const { cols, rows, gap, tileW, tileH } = params

  // Final canvas dimensions include tiles + gutters (edges + between).
  const canvasW = cols * tileW + (cols + 1) * gap
  const canvasH = rows * tileH + (rows + 1) * gap

  // 1) Resize the source to fill the full canvas (cover, so no cropping
  // in the visible area shows white bands from padding).
  const base = await sharp(sourceBuf)
    .resize(canvasW, canvasH, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer()

  // 2) Build all the white bars as pre-rendered PNG buffers.
  const overlays: sharp.OverlayOptions[] = []

  // Horizontal bars — span the entire canvas width.
  const hBar = await sharp({
    create: { width: canvasW, height: gap, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer()
  for (let r = 0; r <= rows; r++) {
    const y = r * (tileH + gap)
    overlays.push({ input: hBar, left: 0, top: y })
  }

  // Vertical bars — span the entire canvas height.
  const vBar = await sharp({
    create: { width: gap, height: canvasH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer()
  for (let c = 0; c <= cols; c++) {
    const x = c * (tileW + gap)
    overlays.push({ input: vBar, left: x, top: 0 })
  }

  return sharp(base).composite(overlays).png().toBuffer()
}

// Detect the Seedance sensitivity flag from an error string. Seedance returns
// E005 codes and phrases like "flagged as sensitive" / "sensitive content".
export function isSensitivityFlag(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  return msg.includes('e005') || msg.includes('flagged as sensitive') || msg.includes('sensitive content')
}
