'use client'

// Theme-aware brand logo. Renders the light-mode (black-on-transparent) asset
// by default, swaps to the dark-mode (white-on-transparent) asset when
// document.documentElement[data-theme='dark'] is set.
//
// Both source files live in /public. Transparent PNGs — no background box
// needed at the wrapper level anymore.

import { useEffect, useState } from 'react'

interface LogoProps {
  size?: number
  className?: string
  alt?: string
  style?: React.CSSProperties
}

export function Logo({ size = 28, className, alt = 'ContentFlow', style }: LogoProps) {
  // Default to light — matches the default theme so SSR + first paint match.
  // The effect below flips to dark on mount if the user has dark mode active,
  // and keeps in sync when the theme toggle fires.
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    // Watch the html element for theme-attribute changes so the logo updates
    // instantly when the user hits the theme toggle in the top bar.
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const src = isDark ? '/logo-dark.png' : '/logo-light.png'
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block', ...style }}
    />
  )
}
