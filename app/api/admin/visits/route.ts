// Admin-only: read recent page_visits + aggregate stats.
// Auth guard uses the same isAdminEmail() helper as the rest of the app.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/pov-access'

export const maxDuration = 15

export async function GET(request: NextRequest) {
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
  const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
  if (!userData?.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const limit = Math.min(500, Math.max(10, parseInt(url.searchParams.get('limit') ?? '200', 10) || 200))
  const sinceHours = Math.min(720, Math.max(1, parseInt(url.searchParams.get('hours') ?? '168', 10) || 168))
  const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

  const { data: visits, error } = await supabase
    .from('page_visits')
    .select('id, created_at, ip, path, referrer, country, city, device, browser')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate stats — done in-memory over the returned window. For large
  // scale we'd move this into a SQL aggregate query.
  const rows = visits ?? []
  const ipCounts = new Map<string, number>()
  const pathCounts = new Map<string, number>()
  const countryCounts = new Map<string, number>()
  for (const v of rows) {
    if (v.ip) ipCounts.set(v.ip, (ipCounts.get(v.ip) ?? 0) + 1)
    if (v.path) pathCounts.set(v.path, (pathCounts.get(v.path) ?? 0) + 1)
    if (v.country) countryCounts.set(v.country, (countryCounts.get(v.country) ?? 0) + 1)
  }
  const topBy = (m: Map<string, number>, n = 10) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }))

  return NextResponse.json({
    visits: rows,
    totals: {
      visits: rows.length,
      uniqueIps: ipCounts.size,
      uniquePaths: pathCounts.size,
      uniqueCountries: countryCounts.size,
    },
    topIps: topBy(ipCounts, 10),
    topPaths: topBy(pathCounts, 10),
    topCountries: topBy(countryCounts, 10),
    windowHours: sinceHours,
  })
}
