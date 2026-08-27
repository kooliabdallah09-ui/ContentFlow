'use client'

// Compact top header for the mobile shell. Replaces the desktop TopBar
// entirely on mobile. Three slots: leading (back button OR menu icon),
// center (page title), trailing (credits chip + notification bell + theme).
// Sticky at the top with a subtle border-bottom.

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bell, Sun, Moon } from 'lucide-react'
import { useCredits } from '@/lib/CreditsContext'

interface MobileHeaderProps {
  title?: string          // Center label — usually the current page name
  showBack?: boolean      // Show back button instead of default (Logo)
  onBack?: () => void     // Custom back handler; defaults to router.back()
  isDark?: boolean
  onToggleTheme?: () => void
  hideCredits?: boolean   // For auth pages where credits are meaningless
}

export function MobileHeader({
  title,
  showBack,
  onBack,
  isDark,
  onToggleTheme,
  hideCredits,
}: MobileHeaderProps) {
  const router = useRouter()
  const { balance } = useCredits()

  const handleBack = () => {
    if (onBack) onBack()
    else router.back()
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top, 0)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          minHeight: 52,
          gap: 8,
        }}
      >
        {/* Leading */}
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 40 }}>
          {showBack ? (
            <button
              onClick={handleBack}
              aria-label="Back"
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: 'transparent', color: 'var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <Link href="/dashboard" aria-label="Home" style={{ display: 'inline-flex' }}>
              {/* Small brand mark — using the theme-aware Logo. */}
              <img
                src={isDark ? '/logo-dark.png' : '/logo-light.png'}
                alt=""
                style={{ width: 32, height: 32, objectFit: 'contain' }}
              />
            </Link>
          )}
        </div>

        {/* Center: page title */}
        <div style={{
          flex: 1, textAlign: 'center', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 15, fontWeight: 600, color: 'var(--ink)',
          letterSpacing: '-0.005em',
        }}>
          {title}
        </div>

        {/* Trailing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 40, justifyContent: 'flex-end' }}>
          {!hideCredits && typeof balance === 'number' && (
            <Link
              href="/settings/billing"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 999,
                background: '#F5E6BC', color: '#7A5A00',
                fontSize: 11.5, fontWeight: 700, textDecoration: 'none',
                fontFamily: 'var(--font-mono, monospace)',
              }}
              aria-label={`${balance} credits`}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#B98B00' }} />
              {balance.toLocaleString()}
            </Link>
          )}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              style={{
                width: 34, height: 34, borderRadius: 10, border: 'none',
                background: 'transparent', color: 'var(--ink-mute)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}
          <Link
            href="/settings/account"
            aria-label="Notifications"
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'transparent', color: 'var(--ink-mute)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Bell size={17} />
          </Link>
        </div>
      </div>
    </header>
  )
}
