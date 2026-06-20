'use client'

import { useState, useRef } from 'react'
import { ACTORS, type Actor } from '@/lib/actors'
import CharacterBuilder from '@/components/CharacterBuilder'
import { type CharacterProfile, EMPTY_CHARACTER } from '@/lib/character'

interface ActorPickerProps {
  value: CharacterProfile
  onChange: (value: CharacterProfile, actorId?: string, customPhoto?: { base64: string; mimeType: string }) => void
  disabled?: boolean
}

// Top-of-section picker: "Library" tab shows a grid of pre-built actors,
// "Custom" tab shows the existing CharacterBuilder form. Picking an actor
// drops its full CharacterProfile into the parent — the downstream
// orchestrate route doesn't care whether the profile came from a card or a form.
export default function ActorPicker({ value, onChange, disabled }: ActorPickerProps) {
  // Always default to the Actor library on first mount — most users will pick
  // a pre-built actor; Custom is for the rare case they want to fully define
  // their own character. The library tab opens with the matching actor pre-selected.
  const matchingActor = ACTORS.find(a => actorMatches(a, value))
  const [tab, setTab] = useState<'library' | 'custom'>('library')
  const [selectedId, setSelectedId] = useState<string | null>(matchingActor?.id ?? null)
  const [customPhoto, setCustomPhoto] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null)
  const [customProfile] = useState<{ gender: string; scene: string }>({ gender: 'Woman', scene: 'Bedroom' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  function pickActor(actor: Actor) {
    setSelectedId(actor.id)
    setCustomPhoto(null)
    onChange(actor.profile, actor.id, undefined)
  }

  function switchToCustom() {
    setTab('custom')
    setSelectedId(null)
    // Don't blow away the form when switching tabs — keep whatever's there.
    // But if the user picked an actor, start the custom form from that actor's
    // values rather than EMPTY so they have something to tweak.
    if (selectedId && value === ACTORS.find(a => a.id === selectedId)?.profile) {
      // keep value as-is
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => setTab('library')}
          disabled={disabled}
          style={tabStyle(tab === 'library')}>
          Actor library
        </button>
        <button
          type="button"
          onClick={switchToCustom}
          disabled={disabled}
          style={tabStyle(tab === 'custom')}>
          Custom
        </button>
      </div>

      {tab === 'library' ? (
        <div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Pre-built actors with a defined look, scene, and vibe. Pick one and we&apos;ll generate the video with that character.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
          }}>
            {ACTORS.map(a => {
              const active = selectedId === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pickActor(a)}
                  disabled={disabled}
                  style={{
                    position: 'relative',
                    padding: 0,
                    background: 'var(--surface)',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, transform 0.15s',
                    transform: active ? 'translateY(-1px)' : 'none',
                  }}>
                  <div style={{
                    width: '100%',
                    aspectRatio: '9 / 16',
                    background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)',
                    overflow: 'hidden',
                  }}>
                    {/* Portrait — falls back to gradient if file missing */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.portrait}
                      alt={a.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{a.tagline}</div>
                  </div>
                  {active && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'var(--ink)', color: '#fff',
                      borderRadius: 999, padding: '2px 8px',
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                    }}>
                      Selected
                    </div>
                  )}
                </button>
              )
            })}

            {/* Upload your photo card */}
            <div style={{ position: 'relative' }}>
              {customPhoto ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId('__custom__')
                    onChange(
                      { ...EMPTY_CHARACTER, gender: customProfile.gender, scene: customProfile.scene },
                      undefined,
                      { base64: customPhoto.base64, mimeType: customPhoto.mimeType },
                    )
                  }}
                  disabled={disabled}
                  style={{
                    position: 'relative',
                    padding: 0,
                    background: 'var(--surface)',
                    border: `1.5px solid ${selectedId === '__custom__' ? 'var(--ink)' : 'var(--border)'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'border-color 0.15s',
                  }}>
                  <div style={{ width: '100%', aspectRatio: '9 / 16', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={customPhoto.previewUrl} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>You</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>Your photo</div>
                  </div>
                  {selectedId === '__custom__' && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--ink)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>Selected</div>
                  )}
                </button>
              ) : (
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  aspectRatio: '9 / 16',
                  background: 'var(--surface)',
                  border: '1.5px dashed var(--border)',
                  borderRadius: 12,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  gap: 8, color: 'var(--ink-mute)', fontSize: 12,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                  </svg>
                  Upload your photo
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={disabled}
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const dataUrl = ev.target?.result as string
                        const [header, b64] = dataUrl.split(',')
                        const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
                        const photo = { base64: b64, mimeType: mime, previewUrl: dataUrl }
                        setCustomPhoto(photo)
                        setSelectedId('__custom__')
                        onChange(
                          { ...EMPTY_CHARACTER, gender: customProfile.gender, scene: customProfile.scene },
                          undefined,
                          { base64: b64, mimeType: mime },
                        )
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      ) : (
        <CharacterBuilder
          value={value}
          onChange={v => {
            setSelectedId(null)
            onChange(v, undefined, undefined)
          }}
          disabled={disabled}
        />
      )}
    </div>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--ink)' : 'transparent'}`,
    color: active ? 'var(--ink)' : 'var(--ink-mute)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: -1,
  }
}

function actorMatches(actor: Actor, profile: CharacterProfile): boolean {
  if (profile === EMPTY_CHARACTER) return false
  const p = actor.profile
  return (
    p.gender === profile.gender &&
    p.age === profile.age &&
    p.ethnicity === profile.ethnicity &&
    p.hair === profile.hair &&
    p.scene === profile.scene
  )
}
