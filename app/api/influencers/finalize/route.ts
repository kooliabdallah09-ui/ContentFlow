// Finalise an in-progress influencer creation. Called after the user picks
// one of the 4 candidate portraits returned by POST /api/influencers.
// Body: { identity, chosenUrl, unusedUrls[], referenceUrls[], model }
//
// Renders the character sheet from the chosen portrait, inserts the
// user_influencers row, deletes the unused candidate uploads. Charges NO
// additional credits — the sheet cost is included in the candidates charge.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateCharacterSheet } from '@/lib/character-sheet'
import { canAccessInfluencerStudio } from '@/lib/pov-access'

export const maxDuration = 90

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function pathFromPublicUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const m = url.match(/\/object\/public\/ugc-assets\/(.+)$/)
  return m ? m[1] : null
}

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = supa()
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canAccessInfluencerStudio(userData.user.email)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const body = await request.json()
    const identity = body?.identity as {
      name?: string
      handle?: string | null
      bio?: string | null
      personality?: string | null
      niche?: string | null
      appearance_prompt?: string
    } | undefined
    if (!identity?.name || !identity?.appearance_prompt) {
      return NextResponse.json({ error: 'Missing identity payload' }, { status: 400 })
    }
    const chosenUrl = typeof body?.chosenUrl === 'string' ? body.chosenUrl : ''
    if (!chosenUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Pick a portrait first' }, { status: 400 })
    }
    // Only accept URLs from our own storage bucket so a malicious client
    // can't seed the row with arbitrary hotlinks.
    if (!pathFromPublicUrl(chosenUrl)?.startsWith('influencers/')) {
      return NextResponse.json({ error: 'Invalid portrait URL' }, { status: 400 })
    }
    const unusedUrls: string[] = Array.isArray(body?.unusedUrls)
      ? body.unusedUrls.filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('http'))
      : []
    const referenceUrls: string[] = Array.isArray(body?.referenceUrls)
      ? body.referenceUrls.filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('http'))
      : []
    const model: 'pro' | 'nb2' = body?.model === 'nb2' ? 'nb2' : 'pro'
    // Regenerate flow: when this is set, UPDATE the existing row in place
    // (new portrait + new appearance_prompt + new sheet) and delete the old
    // portrait / sheet artefacts from storage. Row identity stays the same
    // so downstream references (photoshoots, UGC bridges) don't break.
    const updateInfluencerId = typeof body?.updateInfluencerId === 'string' && body.updateInfluencerId.length > 0
      ? body.updateInfluencerId
      : null

    // Fetch the existing row when we're regenerating so we can wipe its
    // old artefacts after the new ones land.
    let oldPortraitUrl: string | null = null
    let oldSheetUrl: string | null = null
    if (updateInfluencerId) {
      const { data: existing } = await supabase
        .from('user_influencers')
        .select('id, portrait_url, character_sheet_url')
        .eq('id', updateInfluencerId)
        .eq('user_id', userId)
        .maybeSingle()
      if (!existing) return NextResponse.json({ error: 'Influencer not found for update' }, { status: 404 })
      oldPortraitUrl = typeof existing.portrait_url === 'string' ? existing.portrait_url : null
      oldSheetUrl = typeof existing.character_sheet_url === 'string' ? existing.character_sheet_url : null
    }

    // 1) Insert the new row OR update the existing one in place.
    const rowPayload = {
      user_id: userId,
      name: String(identity.name).slice(0, 80),
      handle: typeof identity.handle === 'string' ? identity.handle.slice(0, 40) : null,
      bio: typeof identity.bio === 'string' ? identity.bio.slice(0, 400) : null,
      personality: typeof identity.personality === 'string' ? identity.personality.slice(0, 600) : null,
      niche: typeof identity.niche === 'string' ? identity.niche.slice(0, 120) : null,
      appearance_prompt: String(identity.appearance_prompt).slice(0, 2000),
      portrait_url: chosenUrl,
      reference_urls: referenceUrls.length ? referenceUrls : null,
    }
    let influencer: Record<string, unknown> & { id: string; appearance_prompt: string; character_sheet_url?: string | null }
    if (updateInfluencerId) {
      const { data, error: updErr } = await supabase
        .from('user_influencers')
        .update({ ...rowPayload, character_sheet_url: null })
        .eq('id', updateInfluencerId)
        .eq('user_id', userId)
        .select('*')
        .single()
      if (updErr) throw updErr
      influencer = data
    } else {
      const { data, error: insErr } = await supabase
        .from('user_influencers')
        .insert(rowPayload)
        .select('*')
        .single()
      if (insErr) throw insErr
      influencer = data
    }

    // 2) Character sheet — same drift-safe pattern as before: user's
    // original references anchor it first, chosen portrait rides along.
    // Fail-soft so the influencer still saves if the sheet can't render.
    let userReferenceImages: Array<{ base64: string; mimeType: string }> | undefined
    if (referenceUrls.length) {
      const loaded = await Promise.all(referenceUrls.slice(0, 3).map(async url => {
        try {
          const r = await fetch(url)
          if (!r.ok) return null
          return {
            base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/png',
          }
        } catch { return null }
      }))
      const filtered = loaded.filter((x): x is { base64: string; mimeType: string } => !!x)
      if (filtered.length) userReferenceImages = filtered
    }
    try {
      const sheetUrl = await generateCharacterSheet({
        supabase, userId,
        influencerId: influencer.id,
        appearancePrompt: influencer.appearance_prompt,
        portraitUrl: chosenUrl,
        model,
        userReferenceImages,
      })
      influencer.character_sheet_url = sheetUrl
    } catch (sheetErr) {
      console.warn('[influencers/finalize] character sheet failed:', sheetErr instanceof Error ? sheetErr.message : sheetErr)
    }

    // 3) Best-effort cleanup of the unused candidate uploads so we're not
    // paying storage for renders the user rejected. When regenerating we
    // also wipe the previous portrait + sheet so the row's old artefacts
    // don't linger. Only wipes files under this user's own influencers/
    // prefix.
    const cleanupPaths = [
      ...unusedUrls,
      ...(updateInfluencerId ? [oldPortraitUrl, oldSheetUrl] : []),
    ]
      .map(pathFromPublicUrl)
      .filter((p): p is string => !!p && p.startsWith(`influencers/${userId}-`))
    if (cleanupPaths.length) {
      const { error } = await supabase.storage.from('ugc-assets').remove(cleanupPaths)
      if (error) console.warn('[influencers/finalize] storage cleanup:', error.message)
    }

    return NextResponse.json({ influencer }, { status: 201 })
  } catch (err) {
    console.error('[influencers/finalize] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
