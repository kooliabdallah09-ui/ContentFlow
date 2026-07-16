// Feature gates for beta / testing-only surfaces. Each list is separate so we
// can enable features independently (POV first, then scheduling, then chat).

const ADMIN_EMAILS = new Set<string>(['abdallah.kooli@icloud.com', 'abdallah@icloud.com'])

export const POV_STUDIO_ALLOWED_EMAILS = ADMIN_EMAILS

export function canAccessPovStudio(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}

export function canAccessScheduling(email: string | null | undefined): boolean {
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

export function canAccessInfluencerStudio(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}
