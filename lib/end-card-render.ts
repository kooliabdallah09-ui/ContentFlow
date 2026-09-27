// Renders the end card to an MP4 in the browser with @remotion/web-renderer —
// WebCodecs on the user's machine, the same way the editor already exports.
// No server, no render bill. Browser-only; import it dynamically.

import { END_CARD_FPS, END_CARD_FRAMES, END_CARD_SIZE, type EndCardAspect, type EndCardProps } from './end-card'

export class EndCardRenderError extends Error {
  name = 'EndCardRenderError'
}

// The web renderer paints images onto its own canvas, which a cross-origin
// image would taint, so each one is pulled into a same-origin blob: URL
// first. An image that can't be fetched is dropped rather than failing the
// export — the card still reads fine without it.
async function toLocalUrl(url: string | null, created: string[]): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const local = URL.createObjectURL(await res.blob())
    created.push(local)
    return local
  } catch (err) {
    console.warn('[end-card] image skipped, could not fetch', url, err)
    return null
  }
}

export async function renderEndCardVideo(
  props: EndCardProps,
  aspect: EndCardAspect,
  opts: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {},
): Promise<Blob> {
  const [{ renderMediaOnWeb, canRenderMediaOnWeb }, { EndCard }] = await Promise.all([
    import('@remotion/web-renderer'),
    import('@/components/remotion/EndCard'),
  ])
  const [width, height] = END_CARD_SIZE[aspect]

  const check = await canRenderMediaOnWeb({ width, height, muted: true })
  if (!check.canRender) {
    const reason = check.issues.find(i => i.severity === 'error')?.message
    throw new EndCardRenderError(reason ?? 'This browser can’t render the end card')
  }

  const created: string[] = []
  try {
    const [logoUrl, imageUrl] = await Promise.all([
      toLocalUrl(props.logoUrl, created),
      toLocalUrl(props.imageUrl, created),
    ])
    const inputProps: EndCardProps = { ...props, logoUrl, imageUrl }
    const { getBlob } = await renderMediaOnWeb({
      composition: {
        id: 'end-card',
        component: EndCard,
        durationInFrames: END_CARD_FRAMES,
        fps: END_CARD_FPS,
        width,
        height,
        defaultProps: inputProps,
      },
      inputProps,
      muted: true,
      // Re-encoded once more when spliced into the export, so start high.
      videoBitrate: 'very-high',
      licenseKey: 'free-license',
      onProgress: p => opts.onProgress?.(p.progress),
      signal: opts.signal ?? null,
    })
    return await getBlob()
  } catch (err) {
    if (err instanceof EndCardRenderError) throw err
    throw new EndCardRenderError(err instanceof Error ? err.message : 'End card render failed')
  } finally {
    for (const u of created) URL.revokeObjectURL(u)
  }
}
