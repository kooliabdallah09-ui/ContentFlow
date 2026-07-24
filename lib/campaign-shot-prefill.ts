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

// Read + consume — form initializers use this so refresh doesn't re-apply.
export function readCampaignShotPrefill(): CampaignShotPrefill | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CampaignShotPrefill
    // Keep the campaign/shot IDs alive in a separate cheap key so we can
    // still write library_asset_id back after a successful render even
    // though the form fields were consumed.
    try {
      sessionStorage.setItem(KEY + ':link', JSON.stringify({ campaignId: parsed.campaignId, shotId: parsed.shotId }))
    } catch { /* ignore */ }
    sessionStorage.removeItem(KEY)
    return parsed
  } catch {
    sessionStorage.removeItem(KEY)
    return null
  }
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
