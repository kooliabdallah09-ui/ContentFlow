export interface WordPressPublishPayload {
  title: string
  content: string
  excerpt?: string
  featuredImageUrl?: string
}

export class WordPressPublisher {
  private siteUrl: string
  private username: string
  private appPassword: string

  constructor(siteUrl: string, username: string, appPassword: string) {
    this.siteUrl = siteUrl.replace(/\/$/, '') // Remove trailing slash
    this.username = username
    this.appPassword = appPassword
  }

  private getAuthHeader(): string {
    const credentials = `${this.username}:${this.appPassword}`
    return `Basic ${Buffer.from(credentials).toString('base64')}`
  }

  async publish(payload: WordPressPublishPayload): Promise<string> {
    try {
      // First, upload featured image if provided
      let featuredMediaId: number | null = null
      if (payload.featuredImageUrl) {
        try {
          featuredMediaId = await this.uploadMedia(payload.featuredImageUrl)
        } catch (e) {
          console.warn('Failed to upload featured image, continuing without it')
        }
      }

      // Create the post
      const postData: any = {
        title: payload.title,
        content: payload.content,
        status: 'publish',
        excerpt: payload.excerpt || '',
      }

      if (featuredMediaId) {
        postData.featured_media = featuredMediaId
      }

      const response = await fetch(`${this.siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader(),
        },
        body: JSON.stringify(postData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || `HTTP ${response.status}`)
      }

      const post = await response.json()
      return post.id.toString()
    } catch (error) {
      throw new Error(`Failed to publish to WordPress: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async uploadMedia(imageUrl: string): Promise<number> {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) throw new Error('Failed to fetch image')

    const buffer = await imageResponse.arrayBuffer()
    const filename = `featured-${Date.now()}.jpg`
    const mimeType = 'image/jpeg'

    // Use FormData for multipart upload
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mimeType }), filename)

    const response = await fetch(`${this.siteUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
      },
      body: form,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    const media = await response.json()
    return media.id
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${this.siteUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      })
      return response.ok
    } catch (error) {
      return false
    }
  }
}

export function initializeWordPressPublisher(
  siteUrl: string,
  username: string,
  appPassword: string
): WordPressPublisher {
  return new WordPressPublisher(siteUrl, username, appPassword)
}
