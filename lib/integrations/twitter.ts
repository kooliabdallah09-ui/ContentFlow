import { TwitterApi } from 'twitter-api-v2'

export interface TwitterPublishPayload {
  content: string
}

export class TwitterPublisher {
  private client: TwitterApi

  // accessToken is an OAuth 2.0 user context token from our PKCE flow
  constructor(accessToken: string) {
    this.client = new TwitterApi(accessToken)
  }

  async publish(payload: TwitterPublishPayload): Promise<string> {
    const text = payload.content.substring(0, 280)
    const tweet = await this.client.v2.tweet({ text })
    return tweet.data.id
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      await this.client.v2.me()
      return true
    } catch {
      return false
    }
  }
}

export function initializeTwitterPublisher(accessToken: string): TwitterPublisher {
  return new TwitterPublisher(accessToken)
}
