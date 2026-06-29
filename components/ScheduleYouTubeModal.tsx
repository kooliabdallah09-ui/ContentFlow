'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { X, Youtube, Clock, Lock, Globe, Eye, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  prefill: {
    title: string
    description: string
    calendarDate: string    // 'YYYY-MM-DD'
    suggestedTime: string   // e.g. '7:00 PM'
  }
  onClose: () => void
  onScheduled: (job: ScheduledJob) => void
}

export interface ScheduledJob {
  id: string
  title: string
  scheduled_at: string
  status: string
  yt_video_url?: string
  calendar_date?: string
}

type Privacy = 'public' | 'unlisted' | 'private'

const PRIVACY_OPTIONS: { value: Privacy; label: string; icon: typeof Globe; desc: string }[] = [
  { value: 'public',   label: 'Public',   icon: Globe, desc: 'Anyone can find and watch' },
  { value: 'unlisted', label: 'Unlisted', icon: Eye,   desc: 'Only people with the link' },
  { value: 'private',  label: 'Private',  icon: Lock,  desc: 'Only you can watch' },
]

// Parse '7:00 PM' → '19:00', default to '09:00'
function parseSuggestedTime(s: string): string {
  const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return '09:00'
  let h = parseInt(m[1])
  const min = m[2]
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

export default function ScheduleYouTubeModal({ prefill, onClose, onScheduled }: Props) {
  const [videoUrl, setVideoUrl]     = useState('')
  const [title, setTitle]           = useState(prefill.title.slice(0, 100))
  const [description, setDescription] = useState(prefill.description.slice(0, 5000))
  const [tagsInput, setTagsInput]   = useState('')
  const [privacy, setPrivacy]       = useState<Privacy>('public')
  const [date, setDate]             = useState(prefill.calendarDate)
  const [time, setTime]             = useState(parseSuggestedTime(prefill.suggestedTime))
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [scheduledJob, setScheduledJob] = useState<ScheduledJob | null>(null)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)

      const res = await fetch('/api/youtube/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          video_url: videoUrl.trim(),
          title: title.trim(),
          description: description.trim(),
          tags,
          privacy,
          scheduled_at: scheduledAt,
          calendar_date: prefill.calendarDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to schedule')

      setScheduledJob(data.job)
      setDone(true)
      onScheduled(data.job)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 18,
        border: '1px solid var(--border)',
        width: '100%', maxWidth: 520,
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--border-soft)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#FF0000', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Youtube size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Schedule to YouTube</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>Auto-publishes at the time you pick</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-fade)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {done && scheduledJob ? (
          /* Success state */
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(47,122,78,0.1)', margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={28} color="var(--good)" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Scheduled!</div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
              &ldquo;{scheduledJob.title}&rdquo; will publish on{' '}
              <strong>{new Date(scheduledJob.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
            </div>
            <button onClick={onClose} style={{
              marginTop: 24, padding: '10px 24px', borderRadius: 10,
              background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Video URL */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Video URL <span style={{ color: 'var(--danger)' }}>*</span></span>
              <input
                type="url"
                required
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://… (paste the generated video link)"
                style={inputStyle}
              />
              <span style={hintStyle}>Paste the URL from your generated video or library</span>
            </label>

            {/* Title */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Title <span style={{ color: 'var(--danger)' }}>*</span></span>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 100))}
                placeholder="Video title"
                style={inputStyle}
              />
              <span style={{ ...hintStyle, textAlign: 'right' }}>{title.length}/100</span>
            </label>

            {/* Description */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Description</span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 5000))}
                rows={3}
                placeholder="What this video is about…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
              />
            </label>

            {/* Tags */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Tags</span>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="ugc, product demo, skincare (comma-separated)"
                style={inputStyle}
              />
            </label>

            {/* Date + Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={labelStyle}>Publish date <span style={{ color: 'var(--danger)' }}>*</span></span>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={12} /> Time
                </span>
                <input type="time" required value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
              </label>
            </div>

            {/* Privacy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Privacy</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {PRIVACY_OPTIONS.map(opt => {
                  const Icon = opt.icon
                  const active = privacy === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrivacy(opt.value)}
                      style={{
                        padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                        border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        background: active ? 'var(--ink)' : 'var(--surface-2)',
                        color: active ? 'var(--on-ink)' : 'var(--ink-2)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Icon size={14} />
                      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{opt.label}</span>
                      <span style={{ fontSize: 10, color: active ? 'var(--on-ink-mute)' : 'var(--ink-mute)', lineHeight: 1.3, textAlign: 'center' }}>{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 9,
                background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)',
                color: 'var(--danger)', fontSize: 13,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting || !videoUrl || !title}
              style={{
                padding: '13px 0', borderRadius: 11,
                background: submitting || !videoUrl || !title ? 'var(--ink-faint)' : '#FF0000',
                color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 700,
                cursor: submitting || !videoUrl || !title ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Scheduling…</>
                : <><Youtube size={15} /> Schedule Video</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
  letterSpacing: '0.01em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--bg-elev)', color: 'var(--ink)',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11.5, color: 'var(--ink-mute)',
}
