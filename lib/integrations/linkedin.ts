// LinkedIn UGC Posts API

export async function publishToLinkedIn(params: {
  accessToken: string
  authorId: string   // LinkedIn member URN e.g. "urn:li:person:xxxxx"
  text: string
  imageUrl?: string
}) {
  const { accessToken, authorId, text, imageUrl } = params

  // Ensure authorId is a proper URN
  const author = authorId.startsWith('urn:li:') ? authorId : `urn:li:person:${authorId}`

  let shareMediaCategory = 'NONE'
  const media: object[] = []

  // If there's an image, register it first
  if (imageUrl) {
    try {
      const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: author,
            serviceRelationships: [{
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            }],
          },
        }),
      })

      if (registerRes.ok) {
        const registerData = await registerRes.json()
        const uploadUrl = registerData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
        const asset = registerData?.value?.asset

        if (uploadUrl && asset) {
          // Fetch image and upload to LinkedIn
          const imgRes = await fetch(imageUrl)
          const imgBuffer = await imgRes.arrayBuffer()

          await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            body: imgBuffer,
          })

          shareMediaCategory = 'IMAGE'
          media.push({
            status: 'READY',
            description: { text: text.substring(0, 200) },
            media: asset,
            title: { text: 'Image' },
          })
        }
      }
    } catch {
      // Image upload failed — fall back to text-only post
    }
  }

  const body = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory,
        ...(media.length > 0 && { media }),
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.message || `LinkedIn publish failed: ${response.status}`)
  }

  const data = await response.json()
  return { success: true, postId: data.id || data.value, platform: 'linkedin' }
}
