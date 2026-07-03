// Feature gate for POV Studio. Still in testing — only the emails listed here
// see the working generator. Everyone else sees a "coming soon" screen.
export const POV_STUDIO_ALLOWED_EMAILS = new Set<string>([
  'abdallah.kooli@icloud.com',
])

export function canAccessPovStudio(email: string | null | undefined): boolean {
  if (!email) return false
  return POV_STUDIO_ALLOWED_EMAILS.has(email.toLowerCase())
}
