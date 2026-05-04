import { TwitterApi } from 'twitter-api-v2'

export interface TwitterPublishPayload {
  content: string
  mediaUrls?: string[]
}

export class TwitterPublisher {
  private client: TwitterApi

  constructor(accessToken: string, accessTokenSecret: string, apiKey: string, apiSecret: string) {
    this.client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken,
      accessSecret: accessTokenSecret,
    })
  }

  async publish(payload: TwitterPublishPayload): Promise<string> {
    try {
      const tweet = await this.client.v2.tweet(payload.content)
      return tweet.data.id
    } catch (error) {
      throw new Error(`Failed to publish to Twitter: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      await this.client.v2.me()
      return true
    } catch (error) {
      return false
    }
  }
}

export function initializeTwitterPublisher(
  accessToken: string,
  accessTokenSecret: string,
  apiKey: string,
  apiSecret: string
): TwitterPublisher {
  return new TwitterPublisher(accessToken, accessTokenSecret, apiKey, apiSecret)
}
