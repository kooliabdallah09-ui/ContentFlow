// Session-scoped handoff for the Campaign Planner → Builder flow.
// A campaign shot's "Open in Builder" button lands the user on
// /generate/ugc with URL params. The page copies them into this store
// before the builder mounts; the builder reads it in useState initializers
// so the form paints pre-filled with no flash. Also carries the
// campaign/shot IDs so the render can write library_asset_id back.

const KEY = 'campaignShotPrefill'

export interface CampaignShotPrefill {
  campaignId: string
  shotId: string
  productId?: string
  formatKey?: string
  formatLabel?: string
  hook?: string
  setting?: string
  aspect?: string
  duration?: number
  actorId?: string
  sceneId?: string
  script?: string
  cta?: string
  visualNotes?: string
  caption?: string
}

export function saveCampaignShotPrefill(prefill: CampaignShotPrefill) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(KEY, JSON.stringify(prefill)) } catch { /* quota */ }
}

// Peek without consuming — used by the builder's write-back logic to
// remember which shot to update after render.
export function peekCampaignShotPrefill(): CampaignShotPrefill | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as CampaignShotPrefill : null
  } catch { return null }
}

// Read — PEEKS by default (does not delete). Strict Mode + Next's double-mount
// cycle can invoke useState initializers more than once; if we deleted here
// the second read would come back empty and the form would paint blank.
// The prefill is cleared explicitly after a successful render via
// clearCampaignShotPrefill() below.
export function readCampaignShotPrefill(): CampaignShotPrefill | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CampaignShotPrefill
    // Also mirror the campaign/shot IDs into a persistent link key that
    // survives the eventual clear — needed for write-back on render success.
    try {
      sessionStorage.setItem(KEY + ':link', JSON.stringify({ campaignId: parsed.campaignId, shotId: parsed.shotId }))
    } catch { /* ignore */ }
    return parsed
  } catch {
    sessionStorage.removeItem(KEY)
    return null
  }
}

// Explicit clear — called by the /generate/ugc page after a successful render
// so the next visit without URL params starts fresh.
export function clearCampaignShotPrefill() {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

// Read the persistent link (survives the initial form prefill consumption).
export function peekCampaignShotLink(): { campaignId: string; shotId: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY + ':link')
    return raw ? JSON.parse(raw) as { campaignId: string; shotId: string } : null
  } catch { return null }
}

export function clearCampaignShotLink() {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(KEY + ':link') } catch { /* ignore */ }
}
