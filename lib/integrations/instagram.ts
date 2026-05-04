interface InstagramPublishParams {
  accessToken: string
  caption: string
  imageUrl?: string
  videoUrl?: string
}

export async function publishToInstagram(params: InstagramPublishParams) {
  const { accessToken, caption, imageUrl, videoUrl } = params

  if (!imageUrl && !videoUrl) {
    throw new Error('Either imageUrl or videoUrl is required')
  }

  try {
    // Step 1: Create media container
    const mediaType = imageUrl ? 'IMAGE' : 'VIDEO'
    const mediaUrl = imageUrl || videoUrl

    const createMediaResponse = await fetch(
      `https://graph.instagram.com/v18.0/me/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_type: mediaType,
          image_url: imageUrl,
          video_url: videoUrl,
          caption: caption,
          access_token: accessToken,
        }),
      }
    )

    const mediaData = await createMediaResponse.json()

    if (!mediaData.id) {
      throw new Error(mediaData.error?.message || 'Failed to create media')
    }

    // Step 2: Publish the media
    const publishResponse = await fetch(
      `https://graph.instagram.com/v18.0/me/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creation_id: mediaData.id,
          access_token: accessToken,
        }),
      }
    )

    const publishData = await publishResponse.json()

    if (!publishData.id) {
      throw new Error(publishData.error?.message || 'Failed to publish media')
    }

    return {
      success: true,
      postId: publishData.id,
      platform: 'instagram',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: errorMessage,
      platform: 'instagram',
    }
  }
}

export async function publishToFacebook(params: {
  accessToken: string
  pageId: string
  caption: string
  imageUrl?: string
  videoUrl?: string
}) {
  const { accessToken, pageId, caption, imageUrl, videoUrl } = params

  if (!imageUrl && !videoUrl) {
    throw new Error('Either imageUrl or videoUrl is required')
  }

  try {
    const postData: Record<string, string> = {
      message: caption,
      access_token: accessToken,
    }

    if (imageUrl) {
      postData.picture = imageUrl
    }
    if (videoUrl) {
      postData.video_url = videoUrl
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      }
    )

    const data = await response.json()

    if (!data.id) {
      throw new Error(data.error?.message || 'Failed to publish to Facebook')
    }

    return {
      success: true,
      postId: data.id,
      platform: 'facebook',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: errorMessage,
      platform: 'facebook',
    }
  }
}
