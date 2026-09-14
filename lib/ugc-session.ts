'use client'

// Persists the UGC chat so navigating away and coming back doesn't land you on
// an empty builder while a render is still going.
//
// Two things make this more than a JSON.stringify:
//
//  1. Messages carry live callbacks (onPickFrame, onScriptApprove, …). Those
//     close over the running pipeline and can't be serialised. They're dropped
//     on save, which means a restored frame-picker or script bubble comes back
//     read-only — the render it belonged to has already moved on, so re-arming
//     them would promise an interaction that can't work.
//
//  2. BuilderState holds base64 image blobs (product photo, reference images).
//     A couple of those blow past the ~5MB storage quota on their own, so they
//     are stripped. A restored session keeps the product's name and the
//     picked creator/scene/format; re-attaching a photo is on the user.

const KEY = 'cf-ugc-session-v1'
const MAX_AGE_MS = 6 * 60 * 60 * 1000   // 6h — older than this isn't worth restoring

// Fields on a Message that are functions, and so can't survive a round-trip.
const CALLBACK_FIELDS = ['onScriptChange', 'onScriptRerun', 'onScriptApprove', 'onPickFrame'] as const

export interface PersistedSession {
  savedAt: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripCallbacks(msg: any): any {
  const out = { ...msg }
  for (const f of CALLBACK_FIELDS) delete out[f]
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripBlobs(state: any): any {
  const out = { ...state }
  // Keep the shape so the UI still knows a product image was attached, but
  // drop the payload that would blow the quota.
  if (out.productImage) out.productImage = undefined
  if (Array.isArray(out.referenceImages)) out.referenceImages = []
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveUgcSession(messages: any[], state: any): void {
  if (typeof window === 'undefined') return
  // Nothing worth restoring before the conversation has started.
  if (!messages.length) return
  try {
    const payload: PersistedSession = {
      savedAt: Date.now(),
      messages: messages.map(stripCallbacks),
      state: stripBlobs(state),
    }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Quota or private-mode failure. Losing the transcript is survivable —
    // the render itself is tracked server-side — so this stays silent.
  }
}

export function loadUgcSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY)
      return null
    }
    if (!Array.isArray(parsed.messages) || !parsed.messages.length) return null
    return parsed
  } catch {
    return null
  }
}

export function clearUgcSession(): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}
