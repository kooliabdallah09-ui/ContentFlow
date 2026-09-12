'use client'

import { AdTeardown } from '@/components/AdTeardown'

// In-app Ad Teardown for signed-in users — renders inside the app shell
// (sidebar, credit balance, top bar). The public marketing version lives at
// /teardown; both share the same AdTeardown component.
export default function TeardownAppPage() {
  return <AdTeardown />
}
