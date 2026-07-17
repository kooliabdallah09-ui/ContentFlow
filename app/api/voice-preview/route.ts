// Voice preview samples — lazily generated ONCE per voice, then served from
// storage forever. GET ?voice=Drew → 302 to the cached MP3 (generating it
// on first request). Voice names are whitelisted so this can't be abused as
// a free TTS endpoint.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSpeech } from '@/lib/tts'

export const maxDuration = 60

const SAMPLE_LINES: Record<string, string> = {
  Drew:   "Hey — I'm Drew. Confident, warm, and easy to trust. This is how your demo will sound.",
  Paul:   "I'm Paul. Grounded, authoritative — the voice you want explaining what your product does.",
  James:  "James here. Smooth and conversational, like a friend walking you through the app.",
  Rachel: "Hi, I'm Rachel. Calm and conversational — perfect for a clean, credible walkthrough.",
  Hope:   "Hey hey, I'm Hope! Bubbly, vibrant, and full of energy for your next launch video.",
  Sarah:  "Hi! I'm Sarah — bright and friendly. Your product tour is going to sound amazing.",
  Aria:   "I'm Aria! Energetic and expressive — let's make people actually finish your demo.",
}

export async function GET(request: NextRequest) {
  try {
    const voice = request.nextUrl.searchParams.get('voice') ?? ''
    if (!(voice in SAMPLE_LINES)) {
      return NextResponse.json({ error: 'Unknown voice' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const path = `voice-previews/${voice}.mp3`
    const publicUrl = supabase.storage.from('ugc-assets').getPublicUrl(path).data.publicUrl

    // Cached already?
    const { data: existing } = await supabase.storage
      .from('ugc-assets')
      .list('voice-previews', { search: `${voice}.mp3` })
    if (existing?.some(f => f.name === `${voice}.mp3`)) {
      return NextResponse.redirect(publicUrl, 302)
    }

    // First request for this voice — generate once and cache.
    console.log(`[voice-preview] generating sample for ${voice}`)
    const buffer = await generateSpeech(SAMPLE_LINES[voice], voice)
    const { error: upErr } = await supabase.storage
      .from('ugc-assets')
      .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })
    if (upErr) {
      // Still serve the audio even if caching failed.
      return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'audio/mpeg' } })
    }
    return NextResponse.redirect(publicUrl, 302)
  } catch (err) {
    console.error('[voice-preview] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Preview unavailable' }, { status: 500 })
  }
}
