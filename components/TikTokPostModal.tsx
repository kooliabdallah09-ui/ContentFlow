'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

// "Post to TikTok" window. Follows TikTok's Content Sharing Guidelines, which
// App Review checks: fresh creator info on open, nickname shown, no default
// privacy, interactions unchecked by default (greyed out when the creator
// turned them off), commercial-content disclosure, TikTok's consent text,
// a preview, and nothing sent until the user presses Post.
// Rules are enforced again server-side in /api/tiktok/post.

type Creator = {
  creator_avatar_url?: string
  creator_nickname?: string
  creator_username?: string
  privacy_level_options: string[]
  comment_disabled: boolean
  duet_disabled: boolean
  stitch_disabled: boolean
  max_video_post_duration_sec: number
}

type Item = { id: string; storage_url: string; metadata?: { script?: string; productName?: string; duration?: number } }

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Everyone',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
}
const MUSIC = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en'
const BC_POLICY = 'https://www.tiktok.com/legal/page/global/bc-policy/en'

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabase()
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function defaultCaption(item: Item): string {
  const script = (item.metadata?.script ?? '').replace(/\s+/g, ' ').trim()
  const first = script.split(/(?<=[.!?])\s/)[0] ?? ''
  return (first || item.metadata?.productName || '').slice(0, 150)
}

export function TikTokPostModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'not_connected' | 'error' | 'ready' | 'posting' | 'sent'>('loading')
  const [message, setMessage] = useState('')
  const [creator, setCreator] = useState<Creator | null>(null)
  const [caption, setCaption] = useState(() => defaultCaption(item))
  const [privacy, setPrivacy] = useState('')
  const [allowComment, setAllowComment] = useState(false)
  const [allowDuet, setAllowDuet] = useState(false)
  const [allowStitch, setAllowStitch] = useState(false)
  const [disclose, setDisclose] = useState(false)
  const [yourBrand, setYourBrand] = useState(false)
  const [branded, setBranded] = useState(false)
  const [postId, setPostId] = useState<string | null>(null)
  const [postStatus, setPostStatus] = useState<'processing' | 'published' | 'failed'>('processing')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await fetch('/api/tiktok/creator-info', { headers: await authHeader() })
      const json = await res.json().catch(() => ({}))
      if (!alive) return
      if (res.ok && json.creator) { setCreator(json.creator); setPhase('ready'); return }
      if (json.code === 'not_connected' || json.code === 'access_token_invalid' || json.code === 'scope_not_authorized') setPhase('not_connected')
      else { setMessage(json.error || 'Could not reach TikTok.'); setPhase('error') }
    })()
    return () => { alive = false }
  }, [])

  // After posting, follow the status until TikTok finishes (max ~3 minutes).
  useEffect(() => {
    if (phase !== 'sent' || !postId) return
    let tries = 0
    const t = setInterval(async () => {
      tries++
      const res = await fetch(`/api/tiktok/status?id=${postId}`, { headers: await authHeader() })
      const json = await res.json().catch(() => ({}))
      if (json.status === 'published' || json.status === 'failed') { setPostStatus(json.status); clearInterval(t) }
      if (tries > 36) clearInterval(t)
    }, 5000)
    return () => clearInterval(t)
  }, [phase, postId])

  // Branded content can't be private (TikTok rule), in both directions.
  const brandedBlocked = privacy === 'SELF_ONLY'
  const brandedOn = branded && !brandedBlocked

  const duration = Number(item.metadata?.duration) || 0
  const tooLong = !!creator && duration > 0 && duration > creator.max_video_post_duration_sec
  const why = !privacy ? 'Choose who can view this video.'
    : disclose && !yourBrand && !brandedOn ? 'You need to indicate if your content promotes yourself, a third party, or both.'
    : tooLong ? `This account can post videos up to ${creator?.max_video_post_duration_sec} seconds.`
    : ''
  const label = disclose && brandedOn ? "Your video will be labeled as 'Paid partnership'"
    : disclose && yourBrand ? "Your video will be labeled as 'Promotional content'" : ''

  async function post() {
    setPhase('posting')
    const res = await fetch('/api/tiktok/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({
        contentId: item.id, title: caption, privacyLevel: privacy,
        allowComment, allowDuet, allowStitch,
        disclose, brandOrganic: yourBrand, brandedContent: brandedOn,
        consent: true,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(json.error || 'TikTok could not take the post.'); setPhase('ready'); return }
    setPostId(json.postId ?? null)
    setPhase('sent')
  }

  return (
    <div className="ttp-backdrop" onClick={onClose}>
      <div className="ttp" onClick={e => e.stopPropagation()} role="dialog" aria-label="Post to TikTok">
        {phase === 'sent' ? (
          <div className="ttp-done">
            <span className={`ttp-status ${postStatus}`}>
              {postStatus === 'processing' ? 'Processing on TikTok' : postStatus === 'published' ? 'Posted' : 'TikTok could not post this video'}
            </span>
            <h3>Sent to TikTok</h3>
            <p>It may take a few minutes for your video to process and appear on your TikTok profile.</p>
            <button className="ttp-btn ghost" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="ttp-prev">
              <video src={item.storage_url} controls playsInline muted />
              {creator && <p>Preview of what will be posted. Longest video this account can post: {Math.round(creator.max_video_post_duration_sec / 60) || 1} min.</p>}
            </div>

            <div className="ttp-form">
              <div className="ttp-head">
                {creator?.creator_avatar_url ? <img src={creator.creator_avatar_url} alt="" /> : <span className="ttp-av" />}
                <div>
                  <b>{creator?.creator_nickname ?? 'TikTok'}</b>
                  <small>{creator?.creator_username ? `Posting to @${creator.creator_username}` : 'Post to TikTok'}</small>
                </div>
                <button className="ttp-x" onClick={onClose} aria-label="Close">×</button>
              </div>

              {phase === 'loading' && <p className="ttp-muted">Loading your TikTok account…</p>}
              {phase === 'not_connected' && (
                <div className="ttp-empty">
                  <p>Connect your TikTok account to post videos directly.</p>
                  <Link href="/settings/integrations" className="ttp-btn dark">Connect TikTok</Link>
                </div>
              )}
              {phase === 'error' && <p className="ttp-warn">{message}</p>}

              {creator && (phase === 'ready' || phase === 'posting') && (
                <>
                  <div>
                    <label className="ttp-l" htmlFor="ttp-cap">Caption</label>
                    <textarea id="ttp-cap" value={caption} maxLength={2200} onChange={e => setCaption(e.target.value)} />
                    <div className="ttp-count">{caption.length} / 2200</div>
                  </div>

                  <div>
                    <label className="ttp-l" htmlFor="ttp-priv">Who can view this video</label>
                    <select id="ttp-priv" value={privacy} onChange={e => setPrivacy(e.target.value)}>
                      <option value="" disabled>Select privacy…</option>
                      {creator.privacy_level_options.map(p => (
                        <option key={p} value={p} disabled={p === 'SELF_ONLY' && disclose && brandedOn}
                          title={p === 'SELF_ONLY' && disclose && brandedOn ? 'Branded content visibility cannot be set to private.' : undefined}>
                          {PRIVACY_LABELS[p] ?? p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="ttp-l">Allow users to</span>
                    <div className="ttp-checks">
                      {([
                        ['Comment', allowComment, setAllowComment, creator.comment_disabled],
                        ['Duet', allowDuet, setAllowDuet, creator.duet_disabled],
                        ['Stitch', allowStitch, setAllowStitch, creator.stitch_disabled],
                      ] as const).map(([name, on, set, off]) => (
                        <label key={name} className={off ? 'off' : ''} title={off ? `${name} is turned off in this account's TikTok settings` : undefined}>
                          <input type="checkbox" checked={on && !off} disabled={off} onChange={e => set(e.target.checked)} /> {name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="ttp-box">
                    <div className="ttp-tog">
                      <div>
                        <b>Disclose commercial content</b>
                        <small>Indicate whether this content promotes yourself, a brand, product or service</small>
                      </div>
                      <button type="button" className={`ttp-sw${disclose ? ' on' : ''}`} aria-pressed={disclose} aria-label="Disclose commercial content"
                        onClick={() => setDisclose(d => !d)} />
                    </div>
                    {disclose && (
                      <div className="ttp-sub">
                        <label><input type="checkbox" checked={yourBrand} onChange={e => setYourBrand(e.target.checked)} />
                          <span>Your brand<small>You are promoting yourself or your own business.</small></span></label>
                        <label className={brandedBlocked ? 'off' : ''} title={brandedBlocked ? 'Branded content visibility cannot be set to private.' : undefined}>
                          <input type="checkbox" checked={brandedOn} disabled={brandedBlocked} onChange={e => setBranded(e.target.checked)} />
                          <span>Branded content<small>{brandedBlocked ? 'Branded content visibility cannot be set to private.' : 'You are promoting another brand or a third party.'}</small></span></label>
                        {label && <div className="ttp-label">{label}</div>}
                      </div>
                    )}
                  </div>

                  <div className="ttp-ai"><span>AI-generated</span> TikTok will show &quot;Creator labeled as AI-generated&quot; on this video.</div>

                  <div className="ttp-foot">
                    <div>
                      <p className="ttp-consent">
                        By posting, you agree to TikTok&apos;s{' '}
                        {disclose && brandedOn && <><a href={BC_POLICY} target="_blank" rel="noopener noreferrer">Branded Content Policy</a> and </>}
                        <a href={MUSIC} target="_blank" rel="noopener noreferrer">Music Usage Confirmation</a>.
                      </p>
                      {(why || message) && <p className="ttp-warn">{why || message}</p>}
                    </div>
                    <button className="ttp-btn dark" disabled={!!why || phase === 'posting'} onClick={post}>
                      {phase === 'posting' ? 'Sending…' : 'Post to TikTok'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.ttp-backdrop{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
.ttp{width:100%;max-width:860px;max-height:92vh;overflow:auto;background:var(--bg);color:var(--ink);border:1px solid var(--border);border-radius:20px;display:grid;grid-template-columns:260px 1fr}
.ttp-prev{background:#111;padding:18px;display:flex;flex-direction:column;gap:10px}
.ttp-prev video{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:12px;background:#000}
.ttp-prev p{margin:0;font-size:12px;color:rgba(255,255,255,.6)}
.ttp-form{padding:22px 24px;display:flex;flex-direction:column;gap:16px;min-width:0}
.ttp-head{display:flex;align-items:center;gap:10px}
.ttp-head img,.ttp-av{width:36px;height:36px;border-radius:50%;object-fit:cover;background:var(--border)}
.ttp-head b{font-weight:600;font-size:14.5px}.ttp-head small{display:block;color:var(--ink-mute);font-size:12.5px}
.ttp-x{margin-left:auto;background:none;border:0;color:var(--ink-mute);font-size:22px;cursor:pointer;line-height:1}
.ttp-l{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.ttp textarea,.ttp select{width:100%;font:inherit;font-size:14px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink)}
.ttp textarea{min-height:80px;resize:vertical}
.ttp-count{text-align:right;font-size:11.5px;color:var(--ink-mute);margin-top:4px}
.ttp-checks{display:flex;gap:18px;flex-wrap:wrap}
.ttp-checks label{display:flex;align-items:center;gap:7px;font-size:14px}
.ttp label.off{color:var(--ink-mute);opacity:.6}
.ttp-box{border:1px solid var(--border);border-radius:14px;padding:12px 14px;background:var(--surface)}
.ttp-tog{display:flex;gap:12px;align-items:flex-start}
.ttp-tog>div{flex:1}.ttp-tog b{font-weight:600;font-size:14px}.ttp-tog small{display:block;color:var(--ink-mute);font-size:12.5px}
.ttp-sw{width:40px;height:24px;border-radius:999px;background:var(--border);position:relative;cursor:pointer;flex-shrink:0;border:0}
.ttp-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}
.ttp-sw.on{background:var(--ink)}.ttp-sw.on::after{left:19px}
.ttp-sub{margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px}
.ttp-sub label{display:flex;gap:9px;align-items:flex-start;font-size:14px}
.ttp-sub small{display:block;color:var(--ink-mute);font-size:12.5px}
.ttp-label{font-size:12.5px;padding:8px 10px;border-radius:10px;background:var(--bg);border:1px solid var(--border)}
.ttp-ai{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--ink-mute)}
.ttp-ai span{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--border);color:var(--ink);font-weight:600}
.ttp-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:14px}
.ttp-consent{margin:0;font-size:12.5px;color:var(--ink-mute);max-width:380px}
.ttp-consent a{color:var(--ink);text-decoration:underline}
.ttp-warn{margin:6px 0 0;font-size:12.5px;color:var(--danger,#b91c1c)}
.ttp-muted{color:var(--ink-mute);font-size:14px;margin:0}
.ttp-empty{display:flex;flex-direction:column;gap:12px;align-items:flex-start}.ttp-empty p{margin:0;font-size:14px}
.ttp-btn{display:inline-flex;align-items:center;justify-content:center;height:42px;padding:0 20px;border-radius:999px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;border:0;text-decoration:none}
.ttp-btn.dark{background:var(--ink);color:var(--on-ink,#fff)}.ttp-btn.ghost{background:var(--surface);color:var(--ink);border:1px solid var(--border)}
.ttp-btn:disabled{opacity:.4;cursor:not-allowed}
.ttp-done{grid-column:1/-1;text-align:center;padding:44px 28px}
.ttp-done h3{font-size:22px;font-weight:500;margin:14px 0 6px}.ttp-done p{color:var(--ink-mute);max-width:420px;margin:0 auto 18px;font-size:14px}
.ttp-status{display:inline-block;font-size:12.5px;padding:6px 12px;border-radius:999px;border:1px solid var(--border)}
.ttp-status.published{border-color:var(--good,#10b981);color:var(--good,#10b981)}.ttp-status.failed{border-color:var(--danger,#b91c1c);color:var(--danger,#b91c1c)}
@media(max-width:720px){.ttp{grid-template-columns:1fr}.ttp-prev{flex-direction:row;align-items:flex-start}.ttp-prev video{width:110px}}
`
