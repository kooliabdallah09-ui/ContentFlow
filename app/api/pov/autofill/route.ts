import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getPovFormat } from '@/lib/pov-formats'

const CREDIT_COST = 1

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const { formatId } = await request.json()
    const format = formatId ? getPovFormat(formatId) : undefined
    if (!format) {
      return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
    }

    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('company_name, description, product_type, target_audience, tone_of_voice, unique_value_prop, brand_mission, customer_pain_points')
      .eq('user_id', userId)
      .maybeSingle()

    if (!brand?.company_name) {
      return NextResponse.json(
        { error: 'Fill your brand profile first (Settings → Brand) so autofill knows what to write about.' },
        { status: 400 }
      )
    }

    const brandCtx = [
      `Brand: ${brand.company_name}`,
      brand.description ? `Description: ${brand.description}` : '',
      brand.product_type ? `Product type: ${brand.product_type}` : '',
      brand.target_audience ? `Target audience: ${brand.target_audience}` : '',
      brand.tone_of_voice ? `Tone: ${brand.tone_of_voice}` : '',
      brand.unique_value_prop ? `Unique value: ${brand.unique_value_prop}` : '',
      brand.customer_pain_points ? `Customer pain points: ${brand.customer_pain_points}` : '',
    ].filter(Boolean).join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `You are writing ad copy for a "${format.name}" POV ad. This format: ${format.tagline}. Duration: ${format.durationSeconds}s.

Brand:
${brandCtx}

Return ONLY valid JSON (no markdown, no explanation) with these exact keys:
{
  "productName": "the brand or specific product name",
  "productDescription": "one clear sentence — what it is and who it's for",
  "benefit": "the exact feeling / moment this specific POV clip should sell (short, concrete, visual)",
  "characterDescription": "one dense sentence describing a UGC creator: ethnicity, age (mid-20s to mid-30s adult), build, skin tone, hair, one small jewelry / accessory, one casual outfit detail — e.g. 'a young Southeast Asian woman, mid-20s, athletic build, warm brown skin, dark hair pulled back into a high ponytail, small gold hoop earrings, oversized black hoodie'",
${format.needsVoiceover ? `  "script": "1-2 sentence casual voiceover — sounds like a friend telling you about it in a DM, uses lowercase and light punctuation, matches the ${format.name} vibe, one phrase in it should feel emphasized so the camera can zoom in on that keyword. Absolutely no profanity, no swear words.",\n` : ''}  "extraDirection": "an optional vibe direction — atmospheric details, props, or lighting notes (2-10 words). E.g. 'warm bedside lamp, messy duvet, coffee mug on nightstand' or 'plants blur in background, evening lamp glow' or 'iced matcha on the table, plant blur behind laptop'."
}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    let jsonText = text
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    const parsed = JSON.parse(jsonText)

    // Tiny credit debit — this is cheap Claude haiku, but we still bill so it isn't abused.
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle()
    if ((credits?.balance ?? 0) >= CREDIT_COST) {
      await supabase
        .from('user_credits')
        .update({ balance: (credits!.balance) - CREDIT_COST })
        .eq('user_id', userId)
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('POV autofill error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Autofill failed' },
      { status: 500 },
    )
  }
}
