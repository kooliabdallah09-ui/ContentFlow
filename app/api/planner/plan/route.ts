import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SMART } from '@/lib/ai-models'
import { checkRateLimit } from '@/lib/rate-limit'
import { HOOK_BANNED } from '@/lib/hook-formulas'
import { itemCost, videoCost } from '@/lib/planner-cost'
import {
  GOALS, GOAL_NOTES, MONDAY, PLAN_FORMATS, PLAN_PLATFORMS, PLAYBOOK_VERSION, STAGE_BRIEF,
  buildSlots, formatsFor, type Goal, type Slot,
} from '@/lib/planner-playbook'

// The weekly Content Planner.
//   GET  -> the user's latest plan with its items and the credits they have left.
//   POST -> build a new plan. Free: it only writes the plan, no credits are taken
//           until the user presses Generate on an item.

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function userFrom(request: NextRequest) {
  const supabase = svc()
  if (!supabase) return { error: NextResponse.json({ error: 'Server not configured' }, { status: 500 }) }
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data } = await supabase.auth.getUser(header.slice(7))
  if (!data.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { supabase, userId: data.user.id }
}

type Db = NonNullable<ReturnType<typeof svc>>

// user_credits.balance already includes pack credits (see lib/deduct-credits.ts),
// so it is the whole spendable amount. Adding pack_credits would count them twice.
async function creditsLeft(supabase: Db, userId: string) {
  const { data } = await supabase.from('user_credits').select('balance').eq('user_id', userId).maybeSingle()
  return Math.max(0, (data as { balance?: number } | null)?.balance ?? 0)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await userFrom(request)
    if ('error' in auth) return auth.error
    const { supabase, userId } = auth

    const { data: plan, error: planErr } = await supabase
      .from('weekly_plans').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    const left = await creditsLeft(supabase, userId)
    if (planErr) {
      // The migration has not been run yet: tell the page instead of pretending there is no plan.
      console.error('[planner] load plan', planErr.message)
      return NextResponse.json({ plan: null, items: [], creditsLeft: left, needsSetup: true })
    }
    if (!plan) return NextResponse.json({ plan: null, items: [], creditsLeft: left })

    const { data: items } = await supabase
      .from('weekly_plan_items').select('*').eq('plan_id', plan.id).order('position', { ascending: true })
    return NextResponse.json({ plan, items: items ?? [], creditsLeft: left })
  } catch (err) {
    console.error('[planner] load', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load the plan' }, { status: 500 })
  }
}

interface Creative { slot?: number; format?: string; hook?: string; alts?: unknown; visual?: string }

export async function POST(request: NextRequest) {
  try {
    const auth = await userFrom(request)
    if ('error' in auth) return auth.error
    const { supabase, userId } = auth

    const limit = await checkRateLimit('planner-plan', userId, 6, 60 * 1000)
    if (!limit.ok) return NextResponse.json({ error: 'Too many requests, try again in a minute' }, { status: 429 })

    const body = await request.json().catch(() => ({}))
    const productName = typeof body.productName === 'string' ? body.productName.trim().slice(0, 200) : ''
    const productDescription = typeof body.productDescription === 'string' ? body.productDescription.trim().slice(0, 2000) : ''
    if (!productName || !productDescription) {
      return NextResponse.json({ error: 'Add a product name and a short description' }, { status: 400 })
    }
    const goal: Goal = (GOALS as readonly string[]).includes(body.goal) ? body.goal : 'sales'
    const platforms: string[] = Array.isArray(body.platforms)
      ? body.platforms.filter((p: unknown): p is string => typeof p === 'string' && (PLAN_PLATFORMS as readonly string[]).includes(p))
      : []
    const chosenPlatforms = platforms.length ? platforms : ['TikTok']
    const postsPerWeek = Math.min(Math.max(Math.round(Number(body.postsPerWeek)) || 5, 1), 7)
    const weekStart = typeof body.weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart) ? body.weekStart : MONDAY()

    let brandBlock = ''
    try {
      const { data: brand } = await supabase.from('brand_profiles')
        .select('target_audience, tone_of_voice').eq('user_id', userId).maybeSingle()
      const lines = [
        brand?.target_audience?.trim() ? `Target audience: ${brand.target_audience.trim()}` : '',
        brand?.tone_of_voice?.trim() ? `Tone of voice: ${brand.tone_of_voice.trim()}` : '',
      ].filter(Boolean)
      if (lines.length) brandBlock = `\nBRAND CONTEXT:\n${lines.join('\n')}\n`
    } catch { /* non-fatal */ }

    // Hooks this user has marked as winners in earlier weeks: more of what works.
    let winnersBlock = ''
    try {
      const { data: winners } = await supabase.from('weekly_plan_items')
        .select('hook, format').eq('user_id', userId).eq('is_winner', true)
        .order('updated_at', { ascending: false }).limit(5)
      if (winners?.length) {
        winnersBlock = `\nHOOKS THAT WORKED FOR THIS STORE BEFORE (learn the pattern, do not repeat them):\n${winners.map(w => `- [${w.format}] ${w.hook}`).join('\n')}\n`
      }
    } catch { /* non-fatal */ }

    const slots = buildSlots(postsPerWeek, chosenPlatforms)

    const slotLines = slots.map(s => {
      const formats = formatsFor(s.kind).join(' | ')
      const len = s.kind === 'video' ? `, ${s.durationSeconds}s video` : s.kind === 'carousel' ? ', 5-slide carousel' : ', single photo'
      return `Slot ${s.position}: ${s.stage} post on ${s.platform}${len}. Stage goal: ${STAGE_BRIEF[s.stage]} Allowed formats: ${formats}`
    }).join('\n')

    const formatNotes = PLAN_FORMATS.map(f => `- ${f.label} (${f.kind}): ${f.skeleton}`).join('\n')

    const prompt = `You plan one week of social content for a small online store. The skeleton of the week is fixed below. You write the creative for each slot.

Product: ${productName}
Description: ${productDescription}
Goal for the week: ${goal}. ${GOAL_NOTES[goal]}
${brandBlock}${winnersBlock}
SLOTS
${slotLines}

FORMATS (a format is the proven structure to copy; the topic matters less)
${formatNotes}

RULES
- Give each slot exactly one format from its allowed list. Use a different format for slots of the same kind where possible.
- "hook" is the first line the viewer sees or hears. It is about the VIEWER (their situation, doubt or curiosity), not the product. Do not name the product or brand in the hook. Under 10 words. Do at least two of: raise a question the viewer cannot leave unanswered, pair with something visually unexpected, carry a specific comparison or concrete detail the product info supports.
- "alts" are 2 other hooks for the same slot, each a clearly different angle.
- "visual" is one sentence: for video, the very first frame (an odd action or unexpected object, never "smiles at camera"); for a carousel, what the slides cover; for a photo, the one shot.
- Plain, human language. Never use: ${HOOK_BANNED.join(', ')}. No emojis, no hashtags.
- Never invent facts, prices, discounts, ratings, customer counts or claims. Use only what the product info supports.
- No health, energy, focus, weight or performance effects (for example "I stay sharp", "no more crash") unless the product info states them. Describe what the product is and how it feels to use instead.

Return ONLY valid JSON, no markdown:
{ "items": [ { "slot": 0, "format": "...", "hook": "...", "alts": ["...", "..."], "visual": "..." } ] }
Return one entry per slot, ${slots.length} in total.`

    const msg = await anthropic.messages.create({
      ...SMART,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'The planner returned malformed output, try again' }, { status: 500 })
    let creative: Creative[] = []
    try { creative = (JSON.parse(match[0]) as { items?: Creative[] }).items ?? [] } catch {
      return NextResponse.json({ error: 'The planner returned malformed output, try again' }, { status: 500 })
    }
    const bySlot = new Map(creative.map(c => [Number(c.slot), c]))

    const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '')
    const isClean = (s: string) => !HOOK_BANNED.some(w => s.toLowerCase().includes(w))
    const rows = slots.map((s: Slot) => {
      const c = bySlot.get(s.position) ?? {}
      const allowed = formatsFor(s.kind)
      const format = allowed.find(f => f.toLowerCase() === clean(c.format, 60).toLowerCase()) ?? allowed[s.position % allowed.length]
      const hookRaw = clean(c.hook, 160)
      const alts = (Array.isArray(c.alts) ? c.alts : []).map(a => clean(a, 160)).filter(a => a && isClean(a))
      const hook = hookRaw && isClean(hookRaw) ? hookRaw : (alts.shift() ?? hookRaw)
      return {
        position: s.position, day_offset: s.dayOffset, time_of_day: s.time, platform: s.platform,
        kind: s.kind, format, stage: s.stage, hook: hook || 'Hook missing, press "Try another hook"',
        alts: [hook, ...alts].filter(Boolean).slice(0, 3),
        visual: clean(c.visual, 240),
        duration_s: s.durationSeconds ?? null, quality: 'full', slides: s.slides ?? null,
      }
    })

    // Fit the plan to the credits the user has: if the full-quality version is
    // too expensive, move the priciest videos to Draft until it fits. If it
    // still does not fit, it is saved as is and the page explains the gap.
    const left = await creditsLeft(supabase, userId)
    let total = rows.reduce((sum, r) => sum + itemCost(r), 0)
    const videosByCost = rows.filter(r => r.kind === 'video').sort((a, b) => (b.duration_s ?? 0) - (a.duration_s ?? 0))
    for (const r of videosByCost) {
      if (total <= left) break
      total -= videoCost(r.duration_s ?? 15, 'full') - videoCost(r.duration_s ?? 15, 'draft')
      r.quality = 'draft'
    }

    const { data: plan, error: planErr } = await supabase.from('weekly_plans').insert({
      user_id: userId, week_start: weekStart, product_name: productName, product_description: productDescription,
      goal, platforms: chosenPlatforms, posts_per_week: postsPerWeek, credits_at_plan: left,
    }).select('*').single()
    if (planErr || !plan) throw new Error(planErr?.message ?? 'Could not save the plan')

    const { data: items, error: itemsErr } = await supabase.from('weekly_plan_items')
      .insert(rows.map(r => ({ ...r, plan_id: plan.id, user_id: userId }))).select('*')
    if (itemsErr) {
      await supabase.from('weekly_plans').delete().eq('id', plan.id)
      throw new Error(itemsErr.message)
    }

    const sorted = (items ?? []).sort((a, b) => a.position - b.position)
    return NextResponse.json({ plan, items: sorted, creditsLeft: left, playbook: PLAYBOOK_VERSION })
  } catch (err) {
    console.error('[planner] build', err)
    const m = err instanceof Error ? err.message : 'Could not build the plan'
    const missing = /relation .* does not exist|weekly_plans|weekly_plan_items/i.test(m)
    return NextResponse.json({ error: missing ? 'The planner tables are not set up yet' : m }, { status: 500 })
  }
}
