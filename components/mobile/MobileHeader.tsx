'use client'

// Press Proof mobile top bar.
//   Home:         logo · credit ticket · bell
//   Tab roots:    big page title · credit ticket · bell (Library, Plan, You)
//   Other pages:  back · page title · credit ticket · bell
// Styles live in globals.css under .mx-*.

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useCredits } from '@/lib/CreditsContext'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'

interface MobileHeaderProps {
  title?: string
  hideCredits?: boolean
  // Kept so the layout's call site stays unchanged; the theme switch now
  // lives on the You tab.
  isDark?: boolean
  onToggleTheme?: () => void
}

const TAB_ROOTS = ['/library', '/campaigns', '/you']

export function MobileHeader({ title, hideCredits }: MobileHeaderProps) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const { balance } = useCredits()

  const isHome = pathname === '/dashboard'
  const isTabRoot = TAB_ROOTS.includes(pathname)

  return (
    <div className="mx-bar">
      {isHome ? (
        <Link href="/dashboard" aria-label="Home" data-press className="mx-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l9 9-9 9-9-9z" /><path d="M12 8l4 4-4 4-4-4z" />
          </svg>
        </Link>
      ) : !isTabRoot ? (
        <button onClick={() => router.back()} aria-label="Back" data-press className="mx-ib">
          <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
        </button>
      ) : null}

      <div className={`mx-title${isTabRoot ? ' big' : ''}`}>{isHome ? '' : title}</div>

      {!hideCredits && typeof balance === 'number' && (
        <Link href="/settings/billing" data-press aria-label={`${balance} credits, open billing`} className="mx-credit">
          <span className="mx-credit-n">{balance.toLocaleString()}</span>
          <span>cr</span>
        </Link>
      )}
      <div className="mx-bell"><NotificationsDropdown /></div>
    </div>
  )
}
