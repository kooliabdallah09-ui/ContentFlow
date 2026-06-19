'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { ACTORS, type Actor } from '@/lib/actors'
import { type CharacterProfile, randomCharacterProfile } from '@/lib/character'
import { Loader2, Download, RefreshCw, Copy, Shuffle } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'

// Internal studio for previewing + regenerating the actor library portraits.
// Each card lets you edit the actor's traits, generate a portrait via Nano Banana
// Pro, preview the result, and download the JPG to drop into /public/actors/.

interface PortraitState {
  loading: boolean
  imageUrl?: string         // data URL for preview
  error?: string
  prompt?: string           // what was actually sent to Nano Banana
}

const FIELDS: Array<{ key: keyof CharacterProfile; label: string; placeholder: string }> = [
  { key: 'gender',         label: 'Gender',         placeholder: 'Woman / Man' },
  { key: 'age',            label: 'Age',            placeholder: 'Late 20s' },
  { key: 'ethnicity',      label: 'Ethnicity',      placeholder: 'South Asian' },
  { key: 'hair',           label: 'Hair',           placeholder: 'Black wavy' },
  { key: 'uniqueFeatures', label: 'Features',       placeholder: 'Freckles / None' },
  { key: 'scene',          label: 'Scene',          placeholder: 'Bathroom' },
  { key: 'mood',           label: 'Mood',           placeholder: 'Relaxed' },
  { key: 'outfit',         label: 'Outfit',         placeholder: 'White tank top' },
  { key: 'accessories',    label: 'Accessories',    placeholder: 'None' },
]

export default function ActorAdminPage() {
  // Each card has independent editable profile + portrait state.
  const [profiles, setProfiles] = useState<Record<string, CharacterProfile>>(() =>
    Object.fromEntries(ACTORS.map(a => [a.id, { ...a.profile }])),
  )
  const [states, setStates] = useState<Record<string, PortraitState>>({})

  function setProfile(id: string, key: keyof CharacterProfile, value: string) {
    setProfiles(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function randomize(id: string) {
    setProfiles(prev => ({ ...prev, [id]: randomCharacterProfile() }))
  }

  async function generate(actor: Actor) {
    setStates(prev => ({ ...prev, [actor.id]: { loading: true } }))
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/admin/actor-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile: profiles[actor.id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      const url = `data:${data.mimeType ?? 'image/png'};base64,${data.imageBase64}`
      setStates(prev => ({
        ...prev,
        [actor.id]: { loading: false, imageUrl: url, prompt: data.prompt },
      }))
      showSuccess('Portrait ready', actor.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setStates(prev => ({ ...prev, [actor.id]: { loading: false, error: msg } }))
      showError('Generation failed', msg)
    }
  }

  function download(actor: Actor) {
    const url = states[actor.id]?.imageUrl
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${actor.id}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function copyProfile(actor: Actor) {
    const p = profiles[actor.id]
    const formatted = `  {
    id: '${actor.id}',
    name: '${actor.name}',
    tagline: '${actor.tagline}',
    portrait: '/actors/${actor.id}.jpg',
    profile: {
      gender: '${p.gender}',
      age: '${p.age}',
      ethnicity: '${p.ethnicity}',
      hair: '${p.hair}',
      uniqueFeatures: '${p.uniqueFeatures}',
      scene: '${p.scene}',
      mood: '${p.mood}',
      outfit: '${p.outfit}',
      accessories: '${p.accessories}',
    },
  },`
    await navigator.clipboard.writeText(formatted)
    showSuccess('Copied', `${actor.name} TS literal copied to clipboard`)
  }

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '42px 40px 90px' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 48,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0,
        }}>
          Actor studio
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 640, lineHeight: 1.55 }}>
          Internal tool. Tweak each actor&apos;s traits, regenerate the portrait, download the JPG and drop it into <code>/public/actors/&lt;id&gt;.jpg</code>. Update <code>lib/actors.ts</code> if you changed any trait values.
        </p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 18,
      }}>
        {ACTORS.map(actor => {
          const profile = profiles[actor.id]
          const state = states[actor.id] ?? { loading: false }
          return (
            <div key={actor.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{actor.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>id: {actor.id}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{actor.tagline}</span>
              </div>

              {/* Portrait preview — 9:16 matches the source so nothing gets cropped */}
              <div style={{
                width: '100%', aspectRatio: '9 / 16', borderRadius: 12,
                background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)',
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {state.loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-mute)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    <span style={{ fontSize: 13 }}>Generating…</span>
                  </div>
                ) : state.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.imageUrl} alt={actor.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  // Try the committed file; fall back to placeholder
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={actor.portrait} alt={actor.name}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>

              {/* Editable fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {FIELDS.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</span>
                    <input
                      type="text"
                      value={profile[f.key]}
                      onChange={e => setProfile(actor.id, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      disabled={state.loading}
                      style={{
                        padding: '6px 8px', borderRadius: 7,
                        background: 'var(--bg-elev)', border: '1px solid var(--border)',
                        color: 'var(--ink)', fontSize: 12, fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => randomize(actor.id)}
                  disabled={state.loading}
                  style={btnSecondary(state.loading)}
                  title="Randomize all traits from the option lists">
                  <Shuffle size={13} /> Random
                </button>
                <button
                  onClick={() => generate(actor)}
                  disabled={state.loading}
                  style={btnPrimary(state.loading)}>
                  <RefreshCw size={13} /> {state.imageUrl ? 'Regenerate' : 'Generate'}
                </button>
                <button
                  onClick={() => download(actor)}
                  disabled={!state.imageUrl}
                  style={btnSecondary(!state.imageUrl)}>
                  <Download size={13} /> Download
                </button>
                <button
                  onClick={() => copyProfile(actor)}
                  style={btnSecondary(false)}
                  title="Copy this actor's TypeScript literal to paste into lib/actors.ts">
                  <Copy size={13} /> Copy TS
                </button>
              </div>

              {state.error && (
                <div style={{
                  padding: '6px 10px', borderRadius: 7,
                  background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)',
                  color: 'var(--danger)', fontSize: 11.5,
                }}>{state.error}</div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 12px', borderRadius: 999,
    background: disabled ? 'var(--ink-faint)' : 'var(--ink)',
    color: '#fff', border: 'none',
    fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  }
}

function btnSecondary(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 12px', borderRadius: 999,
    background: 'var(--surface)', border: '1px solid var(--border)',
    color: disabled ? 'var(--ink-faint)' : 'var(--ink-2)',
    fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
  }
}
