// Feature gates for beta / testing-only surfaces. Each list is separate so we
// can enable features independently (POV first, then scheduling, then chat).

const ADMIN_EMAILS = new Set<string>(['abdallah.kooli@icloud.com', 'abdallah@icloud.com'])

export const POV_STUDIO_ALLOWED_EMAILS = ADMIN_EMAILS

export function canAccessPovStudio(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}

export function canAccessMultiAgentChat(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}

export function canAccessReelAnalyzer(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}

export function canAccessFormats(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}

// Public since launch — any signed-in user.
export function canAccessInfluencerStudio(email: string | null | undefined): boolean {
  return !!email
}

// Admin-only scroll-stop hook v1 (short attention-grabbing clip stitched
// before the main UGC talking-head). Reuses the ADMIN_EMAILS set.
export function canAccessScrollStopHook(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}

// Temporary admin-only alternative video engine (Gemini Omni Flash on Vertex)
// while BytePlus direct-Seedance access is still being provisioned. Remove
// this gate once BytePlus is live and we standardise on Seedance-direct.
export function canAccessOmniFlashVideo(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}
