// Root route → render the landing directly so contentflow-web.com opens
// on the marketing page, not a loading flash or auth screen. Signed-in
// users can still click Sign in → we send them to /dashboard from there.
import LandingPage from './landing/page'

export default function Home() {
  return <LandingPage />
}
