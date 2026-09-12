'use client'

import { AdTeardown } from '@/components/AdTeardown'

// Public top-of-funnel tool. Signed-out visitors get the bare page (the root
// layout only mounts the app shell when there's a user); signed-in users see
// it inside the normal app chrome.
export default function TeardownPage() {
  return <AdTeardown />
}
