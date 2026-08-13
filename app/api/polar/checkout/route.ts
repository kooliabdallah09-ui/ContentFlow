import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST() {
  return NextResponse.json({ error: 'Payments are temporarily unavailable. Please try again later.' }, { status: 503 })
}
