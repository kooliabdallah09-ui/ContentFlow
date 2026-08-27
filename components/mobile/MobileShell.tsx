'use client'

// Mobile chrome wrapper. Adds MobileHeader on top and BottomNav on the
// bottom, gives the middle scrollable content area the right padding so
// the header/nav don't overlap. Used only when useIsMobile() is true.
//
// Rules for when NOT to show the shell:
//   - Public pages (landing, legal, auth) that have their own layout
//   - Onboarding (bespoke full-screen flow)
//   - Editor / studio pages that need the full viewport for a canvas
//
// The `variant` prop controls this:
//   - 'app'     → full shell (header + bottom nav) — default
//   - 'canvas'  → header only, no bottom nav (video editor etc.)
//   - 'flow'    → no header, no bottom nav (auth / onboarding)
//   - 'public'  → no shell at all, render children as-is

import { BottomNav } from './BottomNav'
import { MobileHeader } from './MobileHeader'

interface MobileShellProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
  isDark?: boolean
  onToggleTheme?: () => void
  variant?: 'app' | 'canvas' | 'flow' | 'public'
  hideCredits?: boolean
}

export function MobileShell({
  children, title, showBack, onBack,
  isDark, onToggleTheme,
  variant = 'app',
  hideCredits,
}: MobileShellProps) {
  if (variant === 'public') {
    return <>{children}</>
  }

  const showHeader = variant !== 'flow'
  const showBottomNav = variant === 'app'

  return (
    <div className="mobile-shell" style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh',
      // Reserve space for the fixed bottom nav (74px + safe area) so content
      // isn't hidden behind it. The nav renders at 74px + env(safe-area-inset-bottom).
      paddingBottom: showBottomNav ? 'calc(74px + env(safe-area-inset-bottom, 0))' : 0,
      background: 'var(--m-bg)',
    }}>
      {showHeader && (
        <MobileHeader
          title={title}
          showBack={showBack}
          onBack={onBack}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          hideCredits={hideCredits}
        />
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  )
}
