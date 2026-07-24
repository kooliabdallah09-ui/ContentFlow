// Vertex AI video generation — admin-only alternative to Replicate-hosted
// Seedance while BytePlus direct-Seedance access is being provisioned.
// Uses the same GOOGLE_VERTEX_SA_JSON service-account auth we already
// have for Nano Banana Pro on Vertex.
//
// Model default: 'veo-3.1-fast-generate-001' (Veo 3.1 fast). Overridable
// via GOOGLE_VERTEX_VIDEO_MODEL to hit the quality tier
// (veo-3.1-generate-001) or newer previews without a redeploy.
//
// Vertex video is a long-running operation:
//   1. POST :predictLongRunning  → { name: 'projects/…/operations/…' }
//   2. Poll  :fetchPredictOperation with { operationName } until done.
//   3. Response carries video bytes (base64) or a GCS URI.

import { createSign } from 'node:crypto'

const VERTEX_VIDEO_REGION = process.env.GOOGLE_VERTEX_VIDEO_REGION || 'us-central1'
const VERTEX_VIDEO_MODEL = process.env.GOOGLE_VERTEX_VIDEO_MODEL || 'veo-3.1-fast-generate-001'

interface VertexServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

let vertexTokenCache: { token: string; expiresAt: number } | null = null
let vertexSaCache: VertexServiceAccount | null = null

function getVertexSA(): VertexServiceAccount {
  if (vertexSaCache) return vertexSaCache
  const raw = process.env.GOOGLE_VERTEX_SA_JSON
  if (!raw) throw new Error('GOOGLE_VERTEX_SA_JSON not configured')
  const parsed = JSON.parse(raw) as VertexServiceAccount
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('GOOGLE_VERTEX_SA_JSON is missing required fields')
  }
  vertexSaCache = parsed
  return parsed
}

function base64url(input: Buffer | string) {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken(sa: VertexServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (vertexTokenCache && vertexTokenCache.expiresAt > now + 60) return vertexTokenCache.token
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const signInput = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(signInput)
  const signature = base64url(signer.sign(sa.private_key))
  const jwt = `${signInput}.${signature}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vertex token exchange failed ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json() as { access_token: string; expires_in: number }
  vertexTokenCache = { token: data.access_token, expiresAt: now + data.expires_in }
  return data.access_token
}

function endpointBase(sa: VertexServiceAccount) {
  const host = VERTEX_VIDEO_REGION === 'global'
    ? 'aiplatform.googleapis.com'
    : `${VERTEX_VIDEO_REGION}-aiplatform.googleapis.com`
  return `https://${host}/v1/projects/${sa.project_id}/locations/${VERTEX_VIDEO_REGION}/publishers/google/models/${VERTEX_VIDEO_MODEL}`
}

// Kick off a Vertex Video long-running job. The prediction id is prefixed
// with 'omni:' so callers / the status endpoint can distinguish it from a
// Replicate id.
export async function submitOmniFlashJob(params: {
  prompt: string
  durationSeconds: number
  aspectRatio?: '9:16' | '16:9' | '1:1'
  resolution?: '720p' | '1080p'
  enableAudio?: boolean
  startImageBase64?: string
  startImageMimeType?: string
}): Promise<{ predictionId: string }> {
  const sa = getVertexSA()
  const token = await getAccessToken(sa)
  const instance: Record<string, unknown> = { prompt: params.prompt }
  if (params.startImageBase64 && params.startImageMimeType) {
    instance.image = {
      bytesBase64Encoded: params.startImageBase64,
      mimeType: params.startImageMimeType,
    }
  }
  const parameters: Record<string, unknown> = {
    aspectRatio: params.aspectRatio ?? '9:16',
    // Veo 3.1 supports 4, 6, or 8 seconds. Snap to the nearest supported
    // value rather than a raw clamp so a request for 5s → 4s (not 5s reject).
    durationSeconds: [4, 6, 8].reduce((best, v) => Math.abs(v - params.durationSeconds) < Math.abs(best - params.durationSeconds) ? v : best, 4),
    sampleCount: 1,
    personGeneration: 'allow_all',
  }
  if (params.resolution) parameters.resolution = params.resolution
  if (typeof params.enableAudio === 'boolean') parameters.generateAudio = params.enableAudio

  const url = `${endpointBase(sa)}:predictLongRunning`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [instance], parameters }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vertex video submit ${res.status}: ${err.slice(0, 400)}`)
  }
  const data = await res.json() as { name?: string }
  if (typeof data.name !== 'string' || !data.name) {
    throw new Error(`Vertex video: no operation name. Response: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return { predictionId: `omni:${data.name}` }
}

// Poll a Vertex video job. Returns the same shape as getSeedanceStatus so
// the video-status route can treat both providers uniformly. Handles two
// response payload shapes Vertex has shipped across model versions.
export async function getOmniFlashStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  videoBase64?: string
  mimeType?: string
  error?: string
}> {
  const operationName = predictionId.startsWith('omni:') ? predictionId.slice(5) : predictionId
  const sa = getVertexSA()
  const token = await getAccessToken(sa)
  const url = `${endpointBase(sa)}:fetchPredictOperation`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationName }),
  })
  if (!res.ok) {
    const err = await res.text()
    return { status: 'failed', error: `Vertex poll ${res.status}: ${err.slice(0, 300)}` }
  }
  const data = await res.json() as {
    done?: boolean
    error?: { message?: string }
    response?: {
      videos?: Array<{ bytesBase64Encoded?: string; gcsUri?: string; mimeType?: string }>
      generatedSamples?: Array<{ video?: { uri?: string; bytesBase64Encoded?: string } }>
    }
  }
  if (data.error?.message) return { status: 'failed', error: data.error.message }
  if (!data.done) return { status: 'processing' }
  const v = data.response?.videos?.[0]
  const s = data.response?.generatedSamples?.[0]?.video
  const b64 = v?.bytesBase64Encoded ?? s?.bytesBase64Encoded
  const uri = v?.gcsUri ?? s?.uri
  const mimeType = v?.mimeType ?? 'video/mp4'
  if (b64) return { status: 'completed', videoBase64: b64, mimeType }
  if (uri) return { status: 'completed', videoUrl: uri, mimeType }
  return { status: 'failed', error: 'Vertex video: operation done but no video in response' }
}

export function isOmniFlashId(predictionId: string): boolean {
  return typeof predictionId === 'string' && predictionId.startsWith('omni:')
}
