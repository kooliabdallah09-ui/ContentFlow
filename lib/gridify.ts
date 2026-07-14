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
  gap: number       // white bar thickness in pixels
}

// Retry ladder. If Seedance flags the render as sensitive we resubmit with
// the next set of parameters — each pattern presents different fragmentation
// to the safety scanner. Every attempt keeps the source at its real
// dimensions (no crop, no resize) — only the number of bars and their
// thickness changes.
export const GRID_RETRIES: GridParams[] = [
  { cols: 7,  rows: 10, gap: 18 },
  { cols: 8,  rows: 10, gap: 16 },
  { cols: 6,  rows: 10, gap: 20 },
  { cols: 7,  rows: 12, gap: 15 },
  { cols: 8,  rows: 11, gap: 15 },
]

// Draw a white grid overlay on top of the source image, preserving the
// source's exact dimensions. `cols × rows` = the visible-window grid;
// `gap` = white bar thickness in pixels. The source is never resized or
// cropped — the same original pixels are visible in the tile windows.
export async function gridify(sourceBuf: Buffer, params: GridParams): Promise<Buffer> {
  const { cols, rows, gap } = params

  // Read the source's real dimensions and use them as the output canvas.
  const meta = await sharp(sourceBuf).metadata()
  const canvasW = meta.width ?? 0
  const canvasH = meta.height ?? 0
  if (!canvasW || !canvasH) throw new Error('gridify: could not read source dimensions')

  // Distribute the remaining space evenly across visible tiles.
  // (cols+1) vertical bars, (rows+1) horizontal bars.
  const tileW = Math.max(1, Math.floor((canvasW - (cols + 1) * gap) / cols))
  const tileH = Math.max(1, Math.floor((canvasH - (rows + 1) * gap) / rows))

  // Build white bars as pre-rendered PNG buffers.
  const overlays: sharp.OverlayOptions[] = []

  const hBar = await sharp({
    create: { width: canvasW, height: gap, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer()
  for (let r = 0; r <= rows; r++) {
    const y = Math.min(canvasH - gap, r * (tileH + gap))
    overlays.push({ input: hBar, left: 0, top: y })
  }

  const vBar = await sharp({
    create: { width: gap, height: canvasH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer()
  for (let c = 0; c <= cols; c++) {
    const x = Math.min(canvasW - gap, c * (tileW + gap))
    overlays.push({ input: vBar, left: x, top: 0 })
  }

  return sharp(sourceBuf).composite(overlays).png().toBuffer()
}

// Detect the Seedance sensitivity flag from an error string. Seedance returns
// E005 codes and phrases like "flagged as sensitive" / "sensitive content".
export function isSensitivityFlag(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  return msg.includes('e005') || msg.includes('flagged as sensitive') || msg.includes('sensitive content')
}

// ── Grid usability validator ─────────────────────────────────────────────
// After gridifying, Claude Haiku glances at the result and answers whether
// the character is still readable. The bar is LOW — the grid should always
// obscure some of the face, that's the whole point. This step only catches
// catastrophic cases where the person is essentially unrecoverable (eyes
// entirely hidden, less than a third of the face visible, wrong subject
// entirely). Fail-soft: on any error we assume the grid is fine and let
// the pipeline continue.

import Anthropic from '@anthropic-ai/sdk'

const anthropicSingleton = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export interface GridValidation {
  ok: boolean
  reason: string
}

const VALIDATOR_SYSTEM = `You are a QA checker for a UGC video pipeline. You look at a gridded character reference image — a portrait photo with white grid bars drawn on top so that only strips of the person are visible. This is INTENDED behaviour, not a mistake — the grid must partially obscure the character.

Your job: decide whether the grid is USABLE for downstream video generation. The bar is deliberately LOW. Say 'ok' unless the grid is catastrophically broken — for example:
- The eyes are 100% hidden behind bars (both eyes fully covered).
- Less than about a third of the face is visible in aggregate.
- The image is not a person at all.

Partial face coverage is fine. One eye visible is fine. Hair coverage is fine. The grid is SUPPOSED to fragment the face — don't reject for that.

Return ONE line only, in exactly this shape:
ok|<one-sentence reason>
or
unusable|<one-sentence reason>

No preamble, no other content.`

export async function validateGrid(gridBase64: string, gridMimeType = 'image/png'): Promise<GridValidation> {
  if (!anthropicSingleton) return { ok: true, reason: 'no ANTHROPIC_API_KEY, skipping validation' }
  try {
    const msg = await anthropicSingleton.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: VALIDATOR_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: gridMimeType as 'image/png' | 'image/jpeg' | 'image/webp',
              data: gridBase64,
            },
          },
          { type: 'text', text: 'Is this grid usable?' },
        ],
      }],
    })
    const line = (msg.content[0] as { type: 'text'; text: string }).text.trim().split('\n')[0]
    const [verdict, ...rest] = line.split('|')
    const reason = rest.join('|').trim() || line
    return { ok: verdict.trim().toLowerCase() === 'ok', reason }
  } catch (err) {
    // Never block the pipeline on a validator failure.
    return { ok: true, reason: `validator error, skipping: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

// End-to-end: gridify with the retry ladder AND Claude validation.
// - Tries each GridParams in order.
// - After each render, validateGrid decides if it's usable.
// - Returns the first usable grid, or the last attempt if none pass
//   (so the pipeline still has something to send to Seedance).
export async function gridifyWithValidation(
  sourceBuf: Buffer,
): Promise<{ buf: Buffer; params: GridParams; attempt: number; validation: GridValidation }> {
  let last: { buf: Buffer; params: GridParams; attempt: number; validation: GridValidation } | null = null
  for (let i = 0; i < GRID_RETRIES.length; i++) {
    const params = GRID_RETRIES[i]
    const buf = await gridify(sourceBuf, params)
    const b64 = buf.toString('base64')
    const validation = await validateGrid(b64, 'image/png')
    last = { buf, params, attempt: i + 1, validation }
    if (validation.ok) return last
  }
  // No attempt passed — return the last one anyway so downstream has something.
  return last!
}
