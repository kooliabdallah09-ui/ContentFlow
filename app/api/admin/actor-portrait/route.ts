import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { buildCharacterPrompt, type CharacterProfile } from '@/lib/character'

// Admin-only — generates a single actor portrait via Nano Banana Pro for the
// /admin/actors studio page. Auth-gated to any logged-in user (this is a
// local-tooling helper, not a public endpoint). Returns base64 + a portrait
// prompt preview so the UI can show what was sent to the model.
export const maxDuration = 60

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
    const { data: userData, error } = await supabase.auth.getUser(authHeader.slice(7))
    if (error || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const profile = body.profile as CharacterProfile | undefined
    if (!profile) {
      return NextResponse.json({ error: 'Missing profile' }, { status: 400 })
    }

    const characterPrompt = buildCharacterPrompt(profile)

    const SCENE_BACKGROUNDS: Record<string, string> = {
      'Bathroom': 'Setting: a bright modern bathroom — white subway tiles, a fogged mirror edge, a marble or stone countertop with skincare products visible, soft cool morning light from a frosted window. Muted whites and greys. No plants, no warm tones.',
      'Bedroom': 'Setting: a minimal Scandinavian bedroom — unmade linen duvet in off-white, a low oak bed frame, a single bedside lamp glowing amber in daylight, a large window with light curtains blowing slightly. Soft grey and cream palette, no clutter.',
      'Living room': 'Setting: a contemporary urban living room — dark sofa, a low concrete coffee table, abstract geometric wall art in bold colors, a floor lamp with a black shade, city light filtering in from a tall window. Deep blues, charcoal, warm amber highlights. No plants.',
      'Home office': 'Setting: a clean modern home office — a white floating desk with a glowing ultrawide monitor, a ring light off to one side, pegboard with cables and tech accessories on the wall, a mesh ergonomic chair. Cool blue-white LED light. Minimal, tech aesthetic.',
      'Kitchen': 'Setting: a sleek dark kitchen — matte black cabinets, quartz countertop, a pot of simmering water on an induction hob, pendant lights casting warm focused pools. Moody and cinematic. No plants, no open shelves.',
      'Café': 'Setting: a busy specialty coffee shop — exposed brick wall, an espresso machine gleaming in the background, chalkboard menu, wooden tables, late afternoon sunlight slanting through large industrial windows. Warm amber and brick tones.',
      'Gym': 'Setting: a modern gym — black rubber flooring, mirrored wall with weight racks reflected, strip lighting overhead casting sharp shadows, a power cage visible in the mid-ground. High contrast, industrial, no soft textures.',
      'Yoga studio': 'Setting: a serene yoga studio — polished bamboo floor, floor-to-ceiling frosted glass letting in diffuse white light, a rolled mat on the floor, a small singing bowl, simple white walls. Clean, airy, zen. Absolutely no clutter.',
      'Outdoor park': 'Setting: a sunlit city park — a blurred green tree canopy overhead, dappled afternoon light, a gravel path curving away, benches visible in bokeh. Vibrant summer greens and warm golden light.',
      'Beach': 'Setting: a beach at golden hour — blurred ocean horizon, wet sand, orange and pink sky, sea spray mist in the air. Saturated sunset palette, backlit haze.',
      'City street': 'Setting: an urban street at night — neon signs in the background (red, blue, green), rain-slicked asphalt reflecting lights, a blurred taxi, concrete walls. Gritty, high-contrast, cyberpunk-adjacent color palette.',
      'Rooftop': 'Setting: a rooftop at dusk — city skyline silhouetted in the background, blurred high-rise windows lit with warm light, a railing in the foreground, purple and orange gradient sky.',
      'Restaurant': 'Setting: a dimly lit upscale restaurant — white tablecloths, glowing candles, wine glasses, dark wood paneling, a waiter blurred in the background. Rich dark tones, amber candlelight.',
      'Car interior': 'Setting: inside a car at night — dashboard glow, streetlights streaking past the side window in bokeh, steering wheel visible at bottom edge, a dark headliner above. Cinematic noir with blue and amber light.',
      'Closet / dressing room': 'Setting: a walk-in closet / dressing room — neatly hung clothes in a neutral palette, a full-length mirror reflecting the back wall, warm LED strip lighting below the clothes rail, a velvet ottoman. Cream, beige, fashion-editorial.',
    }

    const sceneClause = profile.scene && SCENE_BACKGROUNDS[profile.scene]
      ? SCENE_BACKGROUNDS[profile.scene]
      : `Setting: a distinctive indoor environment with strong character — bold colors, clear depth, visible architectural or design details. Background must NOT be warm beige/cream with plants. Choose an unexpected, specific aesthetic.`
    const prompt = `Hyper-realistic UGC selfie portrait of ${characterPrompt}.

${sceneClause}

Framing: vertical 9:16 phone portrait, shot from arm's length like a creator filming themselves. Head and upper torso fully visible from the top of the hair down to the collarbone/chest — DO NOT crop the top of the head or the shoulders. Subject fills roughly the middle 60% of the frame with breathing room above the head.

Lighting: soft natural window light from the side, warm golden tone, gently flattering on the face. Avoid harsh shadows.

Quality: photorealistic phone camera output, real skin texture with pores preserved, natural micro-imperfections, no beauty filter, no studio polish, no plastic skin. Should look like a real Instagram creator's selfie — confident, warm, magnetic, looking the viewer in the eye.`

    // Use the generic image generator so we can lock the aspect ratio to 9:16 —
    // generateTextToImage hardcoded this, but going through the generic path
    // makes the ratio explicit alongside the other portrait params.
    const result = await generateNanoBananaImage(prompt, { ratio: '9:16', style: 'realistic' })

    return NextResponse.json({
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      prompt,
    })
  } catch (err) {
    console.error('actor-portrait error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
