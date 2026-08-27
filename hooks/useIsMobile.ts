'use client'

// Viewport-based mobile detection. Renders desktop on SSR (safe default) then
// flips on the client if the viewport is narrow. Uses matchMedia so it reacts
// to rotations and resizes without listeners on every render.
//
// Threshold: 900px matches the existing responsive CSS breakpoint. Anything
// below gets the purpose-built mobile shell.

import { useEffect, useState } from 'react'

const MOBILE_MAX = 900

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`)
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
