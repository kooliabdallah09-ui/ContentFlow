import { NextResponse } from 'next/server'

// Retired with its connect route.
export function GET() {
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=unavailable`)
}
