// Read the user's saved brand profile and derive the 3 intelligence answers
// (product / audience / goal) so the intelligence step can autofill.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!brand) return NextResponse.json({ error: 'Fill out brand profile first' }, { status: 400 })

    // Simple derivation — no LLM needed for product & audience since brand
    // already stores clean strings. Goal we infer from brand mission.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const goalMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 40,
      messages: [{
        role: 'user',
        content: `Pick the primary content-marketing goal for this brand. Answer with EXACTLY one of these tokens and nothing else:
brand_awareness | drive_sales | build_community | get_ugc_creators

Brand:
- Product: ${brand.product_type ?? ''} — ${brand.description ?? ''}
- Mission: ${brand.brand_mission ?? ''}
- Unique value: ${brand.unique_value_prop ?? ''}`,
      }],
    })
    const goalRaw = (goalMsg.content[0] as { type: 'text'; text: string }).text.trim().toLowerCase()
    const goal = ['brand_awareness', 'drive_sales', 'build_community', 'get_ugc_creators'].includes(goalRaw)
      ? goalRaw
      : 'drive_sales'

    const product = [brand.company_name, brand.description, brand.unique_value_prop]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 800)
    const audience = String(brand.target_audience ?? '').slice(0, 800)

    return NextResponse.json({ answers: { product, audience, goal } })
  } catch (err) {
    console.error('intelligence/ai-fill error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
