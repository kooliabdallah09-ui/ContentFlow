// Intelligence — Step 2 (new): pull the top-performing short-form video
// from each of TikTok / Instagram Reels / YouTube Shorts for the user's
// niche keywords, then have Gemini extract the hook / format / pacing /
// caption style for each. Stored on user_intelligence.top_video_analyses
// and later fed into generate-plan.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchTopVideosAcrossPlatforms } from '@/lib/intelligence/top-videos'
import { analyzeVideoWithGemini } from '@/lib/intelligence/gemini-analyze'

export const maxDuration = 180

export async function POST(request: NextRequest) {
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
    const userId = userData.user.id

    const { data: profile } = await supabase
      .from('user_intelligence')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (!profile) return NextResponse.json({ error: 'Complete onboarding first' }, { status: 400 })

    const keywords = Array.isArray(profile.trend_keywords) && profile.trend_keywords.length
      ? profile.trend_keywords
      : [String(profile.niche ?? '').replace(/_/g, ' ')]

    const { candidates, debug } = await fetchTopVideosAcrossPlatforms({ keywords })
    console.log('[analyze-top-videos] scrape debug:', JSON.stringify(debug))

    // Analyze each candidate with Gemini in parallel. Fail-soft: if analysis
    // fails or the fetch itself returned nothing, we save what we have.
    const analyses = await Promise.all(
      candidates.map(async c => {
        // Some platforms (YouTube Shorts) don't hand us a direct mp4 — we still
        // capture the metadata so the plan generator can reference the video.
        if (!c.videoUrl) return { ...c, gemini: null }
        const analysis = await analyzeVideoWithGemini({
          platform: c.platform,
          sourceUrl: c.sourceUrl,
          videoUrl: c.videoUrl,
          caption: c.caption,
          hashtags: c.hashtags,
        })
        return { ...c, gemini: analysis }
      }),
    )

    const { error } = await supabase
      .from('user_intelligence')
      .update({ top_video_analyses: analyses, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ success: true, analyses, count: analyses.length, debug })
  } catch (err) {
    console.error('intelligence/analyze-top-videos error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
