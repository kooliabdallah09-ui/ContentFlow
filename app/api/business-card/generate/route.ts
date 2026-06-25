import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'

const CREDIT_COST = 3

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7))
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const body = await req.json()
    const { form, styleId, accentColor, logoBase64, logoMimeType } = body

    if (!form?.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .single()

    if (!credits || credits.balance < CREDIT_COST) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${CREDIT_COST}, have ${credits?.balance ?? 0}` },
        { status: 400 },
      )
    }

    // Build the style descriptor
    const styleDescriptors: Record<string, string> = {
      minimal: 'minimalist design with a white background, thin elegant serif name in large text, a thin colored accent underline beneath the name, light grey secondary text for title and company, and very small contact details at the bottom in light grey',
      bold: 'bold modern design with a white background, a thick colored vertical stripe on the left edge, very large heavy sans-serif name in black, colored uppercase title text beneath, and small contact details at the bottom left',
      dark: 'dark premium design with a near-black (#0f0f0f) background, white serif name in large text, colored accent title text, grey secondary text for company, and small light grey contact details at the bottom',
      gradient: 'gradient design with a smooth diagonal gradient background from the accent color to a darker shade, all text in white — large serif name at top, white uppercase title, and small semi-transparent white contact details at the bottom',
    }

    const contactLines: string[] = []
    if (form.email)   contactLines.push(`email: ${form.email}`)
    if (form.phone)   contactLines.push(`phone: ${form.phone}`)
    if (form.website) contactLines.push(`website: ${form.website}`)

    const prompt = `Generate a professional business card image. This must look like a real printed business card — no decorative elements, no illustrations, no borders or ornaments beyond what is described.

CARD SPECIFICATIONS:
- Format: horizontal, 3.5×2 inch aspect ratio (landscape)
- Style: ${styleDescriptors[styleId] ?? styleDescriptors.minimal}
- Accent color: ${accentColor}

EXACT TEXT CONTENT (render every word exactly as written, correct spelling and typography):
- Name (largest, dominant): ${form.name}
- Title / Role (secondary, smaller): ${form.title || ''}
- Company (secondary, smaller): ${form.company || ''}
- Tagline / bio (small, subtle): ${form.tagline || ''}
${contactLines.length > 0 ? `- Contact info (smallest, bottom): ${contactLines.join(' | ')}` : ''}

TYPOGRAPHY HIERARCHY (strictly enforce):
1. Name — largest element, 28–36pt equivalent, dominant
2. Title + Company — medium, 12–14pt equivalent
3. Tagline — small italic, 10–11pt equivalent
4. Contact details — smallest, 9–10pt equivalent, clean monospace or sans-serif

QUALITY REQUIREMENTS:
- All text must be perfectly legible and spelled exactly as provided
- No random decorative swirls, flourishes, or abstract shapes
- Clean, purposeful layout — professional print quality
- Render as a flat image of the business card on a neutral white/grey background with a subtle shadow to show depth
- Card corners are slightly rounded (2mm radius)
- Print-ready resolution and sharpness`

    const result = await generateNanoBananaImage(prompt, {
      style: 'professional',
      ratio: '16:9',
      referenceImageBase64: logoBase64 ?? undefined,
      referenceImageMimeType: logoMimeType ?? undefined,
    })

    const { newBalance } = await deductCredits(supabase, userId, CREDIT_COST, credits.balance, credits.pack_credits)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: CREDIT_COST,
      transaction_type: 'generation',
      content_type: 'business-card',
      description: `Business card · ${styleId} · ${form.name}`,
    })

    return NextResponse.json({
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      creditDeducted: CREDIT_COST,
      newBalance,
    })
  } catch (err) {
    console.error('business-card generate error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
