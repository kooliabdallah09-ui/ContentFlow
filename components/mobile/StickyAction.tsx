'use client'

// Thumb-reachable sticky CTA. Sits flush at the bottom above the BottomNav,
// spans the full width, respects safe-area-inset. Use for the primary
// action on a mobile page (Generate, Buy, Confirm, etc.). One button per
// screen — that's the mobile rule.

interface StickyActionProps {
  children: React.ReactNode  // Usually a <button>. Pass whatever you want.
  // Set to true when the sheet/page has NO bottom nav below (e.g. modal
  // sheets, auth flows). Removes the 60px offset that avoids collision.
  standalone?: boolean
}

export function StickyAction({ children, standalone }: StickyActionProps) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: standalone ? 0 : 60,   // 60 = height of BottomNav
        left: 0, right: 0,
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0))',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        zIndex: 40,
      }}
    >
      {children}
    </div>
  )
}
