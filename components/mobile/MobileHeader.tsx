'use client'

// Editorial-warm mobile top header. Matches the Claude design artifact:
//   - Blurred cream background (rgba(251,250,246,.92)) with soft border
//   - Left slot: back button (circle) OR small "C" logo mark
//   - Center: page title in Geist 16.5/600 with tight letter-spacing
//   - Right: amber credits pill with mono number
// The 56px top padding acts as a safe-area substitute so the header
// clears the iOS notch / status bar without a JS measurement.

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sun, Moon } from 'lucide-react'
import { useCredits } from '@/lib/CreditsContext'

interface MobileHeaderProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
  hideCredits?: boolean
  // isDark / onToggleTheme kept for API compat, not currently rendered in
  // the mobile design — the palette is theme-fixed for now.
  isDark?: boolean
  onToggleTheme?: () => void
}

export function MobileHeader({
  title,
  showBack,
  onBack,
  hideCredits,
  isDark,
  onToggleTheme,
}: MobileHeaderProps) {
  const router = useRouter()
  const { balance } = useCredits()

  const handleBack = () => {
    if (onBack) onBack()
    else router.back()
  }

  return (
    <div
      style={{
        flexShrink: 0,
        padding: 'max(56px, calc(env(safe-area-inset-top, 20px) + 12px)) 18px 10px',
        // Use the app's surface color so the header blends with whatever
        // theme the page below is running (light cream on mobile-native
        // pages, dark on dashboard-app pages that haven't been ported
        // yet). Fallback keeps the design-artifact cream if the surface
        // token isn't defined.
        background: 'var(--surface, rgba(251, 250, 246, 0.92))',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border, var(--m-border))',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {showBack ? (
        <button
          onClick={handleBack}
          aria-label="Back"
          data-press
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--m-surface-2)',
            border: '1px solid var(--m-border)',
            display: 'grid', placeItems: 'center',
            fontSize: 15, color: 'var(--m-ink-3)',
            cursor: 'pointer', flexShrink: 0, padding: 0,
            fontFamily: 'var(--m-sans)',
          }}
        >
          ←
        </button>
      ) : (
        <Link
          href="/dashboard"
          aria-label="Home"
          data-press
          style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'var(--m-ink)',
            display: 'grid', placeItems: 'center',
            flexShrink: 0, textDecoration: 'none',
          }}
        >
          <span style={{
            color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: 'var(--m-mono)',
          }}>
            C
          </span>
        </Link>
      )}

      <div style={{
        flex: 1, minWidth: 0,
        fontSize: 16.5, fontWeight: 600,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: 'var(--m-ink)',
      }}>
        {title}
      </div>

      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          data-press
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'transparent',
            border: '1px solid var(--m-border)',
            color: 'var(--m-ink-3)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      )}
      {!hideCredits && typeof balance === 'number' && (
        <Link
          href="/settings/billing"
          data-press
          aria-label={`${balance} credits — open billing`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--m-credits-bg)',
            border: '1px solid var(--m-credits-border)',
            borderRadius: 99, padding: '5px 11px 5px 8px',
            flexShrink: 0, textDecoration: 'none',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--m-credits-dot)' }} />
          <span style={{
            fontFamily: 'var(--m-mono)', fontSize: 11.5,
            fontWeight: 600, color: 'var(--m-credits-ink)',
          }}>
            {balance.toLocaleString()}
          </span>
        </Link>
      )}
    </div>
  )
}
