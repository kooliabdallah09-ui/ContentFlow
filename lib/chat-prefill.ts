// One-shot handoff for the /ask agent → generator flow. When Kooli navigates
// the user to a generator via the open_generator tool, we stash the user's
// original request here; the target page reads and clears it on mount.

const KEY = 'chatPrefillTopic'

export function readChatPrefill(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return raw
  } catch {
    return null
  }
}
