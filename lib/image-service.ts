export async function getUnsplashImage(query: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&count=1&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || 'K_Th2l6iheJpFCzWUdEHDOAflR5nxjKvN7X-9VRU3gw'}`
        }
      }
    )

    if (!response.ok) {
      return `https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=630&fit=crop`
    }

    const data = await response.json()
    if (data.results && data.results.length > 0) {
      return `${data.results[0].urls.regular}?w=1200&h=630&fit=crop`
    }

    return `https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=630&fit=crop`
  } catch (error) {
    console.error('Image fetch error:', error)
    return `https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=630&fit=crop`
  }
}
