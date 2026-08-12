// Assign + preview an ElevenLabs voice for an influencer.
// GET  → { voiceId, voices }        (influencer's current voice + all options)
// POST { voiceId, previewText? }    → { audioUrl, voiceId }  (save + generate preview)
// DELETE                            → removes assigned voice

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccessInfluencerStudio } from '@/lib/pov-access'
import { generateSpeech } from '@/lib/tts'
import { ELEVENLABS_VOICES } from '@/lib/elevenlabs'
import { OPENAI_VOICES } from '@/lib/tts'

export const maxDuration = 30

function supa() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function authAdmin(req: NextRequest): Promise<{ userId: string } | null> {
  const h = req.headers.get('Authorization')
  if (!h?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(h.slice(7))
  if (!data.user || !canAccessInfluencerStudio(data.user.email)) return null
  return { userId: data.user.id }
}

const ALL_VOICES = [
  ...ELEVENLABS_VOICES.map(v => ({ id: v.id, name: v.name, provider: 'elevenlabs', description: v.description, gender: v.accent })),
  ...OPENAI_VOICES.map(v => ({ id: v.id, name: v.label.split(' — ')[0], provider: 'openai', description: v.label.split(' — ')[1] ?? '', gender: '' })),
]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authAdmin(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data: inf } = await supa()
    .from('user_influencers')
    .select('voice_id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (!inf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ voiceId: inf.voice_id ?? null, voices: ALL_VOICES })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authAdmin(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : ''
  if (!voiceId) return NextResponse.json({ error: 'voiceId required' }, { status: 400 })

  const supabase = supa()

  // Verify influencer belongs to user
  const { data: inf } = await supabase.from('user_influencers').select('id, name').eq('id', id).eq('user_id', auth.userId).maybeSingle()
  if (!inf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Save voice_id
  await supabase.from('user_influencers').update({ voice_id: voiceId }).eq('id', id).eq('user_id', auth.userId)

  // Generate 5-second preview
  const previewText = typeof body.previewText === 'string' && body.previewText.trim().length > 3
    ? body.previewText.trim().slice(0, 300)
    : `Hi, I'm ${inf.name ?? 'your AI influencer'}. I'm excited to share this with you today.`

  try {
    const audioBuf = await generateSpeech(previewText, voiceId)
    const filename = `voice-previews/${auth.userId}-${id}-preview.mp3`
    const { error: upErr } = await supabase.storage
      .from('ugc-assets')
      .upload(filename, audioBuf, { contentType: 'audio/mpeg', upsert: true })
    if (upErr) throw new Error(upErr.message)

    const { data: { publicUrl: audioUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
    return NextResponse.json({ audioUrl, voiceId })
  } catch (err) {
    // Voice preview failed but voice_id was saved — return partial success
    console.error('[influencer/voice] preview failed:', err)
    return NextResponse.json({ audioUrl: null, voiceId, warning: 'Voice saved but preview generation failed' })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authAdmin(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  await supa().from('user_influencers').update({ voice_id: null }).eq('id', id).eq('user_id', auth.userId)
  return NextResponse.json({ success: true })
}
