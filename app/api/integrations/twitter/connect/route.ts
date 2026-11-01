import { NextResponse } from 'next/server'

// Retired: the old connect flow trusted a userId from the query string. Rebuild
// on lib/oauth-state.ts (like TikTok / Google Drive) before re-enabling.
export function GET() {
  return NextResponse.json({ error: 'This integration is not available yet.' }, { status: 410 })
}
export const POST = GET
