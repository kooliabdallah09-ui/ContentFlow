'use client'

import { useState } from 'react'
import { type CharacterProfile, EMPTY_CHARACTER, buildCharacterPrompt, CHARACTER_OPTIONS } from '@/lib/character'

export { type CharacterProfile, EMPTY_CHARACTER, buildCharacterPrompt }

// Option sets per question. Each field also supports an "Other (specify)" free-text input
// for cases the dropdown doesn't cover. Gender intentionally has no "Other" select option —
// it's just 3 choices; non-binary / custom users pick "Other" → text input.
const OPTIONS = CHARACTER_OPTIONS

interface CharacterBuilderProps {
  value: CharacterProfile
  onChange: (value: CharacterProfile) => void
  disabled?: boolean
  // When provided, renders the "name this character" save box. The name is
  // held by the parent (UGCPackageBuilder) so the actual save happens once
  // the hero frame exists — the character then lands in My influencers with
  // its picture, not as a faceless field-set.
  saveName?: string
  onSaveNameChange?: (name: string) => void
}

const OTHER_SENTINEL = '__OTHER__'

export default function CharacterBuilder({ value, onChange, disabled, saveName, onSaveNameChange }: CharacterBuilderProps) {
  // Tracks which fields the user explicitly switched into "Other" mode this session.
  // We also detect "Other" implicitly if the saved value isn't in the predefined options.
  const [otherMode, setOtherMode] = useState<Record<string, boolean>>({})

  const isOtherActive = (field: keyof typeof OPTIONS): boolean => {
    if (otherMode[field]) return true
    const v = value[field as keyof CharacterProfile]
    return !!v && !(OPTIONS[field] as readonly string[]).includes(v)
  }

  const setField = (k: keyof CharacterProfile, v: string) => {
    onChange({ ...value, [k]: v })
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ink-dim)',
    marginBottom: '6px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* The 9 character questions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {(Object.keys(OPTIONS) as Array<keyof typeof OPTIONS>).map(field => {
          const labels: Record<string, string> = {
            gender: 'Gender',
            age: 'Age',
            ethnicity: 'Ethnicity',
            hair: 'Hair',
            uniqueFeatures: 'Unique Feature',
            scene: 'Scene / Where',
            mood: 'Mood / Energy',
            outfit: 'Wearing',
            accessories: 'Accessories',
          }
          const placeholders: Record<string, string> = {
            gender: 'e.g. Non-binary',
            age: 'e.g. 70s',
            ethnicity: 'e.g. Filipino',
            hair: 'e.g. Mid-length blonde with bangs',
            uniqueFeatures: 'e.g. Heterochromia',
            scene: 'e.g. Garage workshop',
            mood: 'e.g. Sarcastic',
            outfit: 'e.g. Vintage band tee + jeans',
            accessories: 'e.g. Vintage camera around neck',
          }
          const useOther = isOtherActive(field)
          const selectValue = useOther ? OTHER_SENTINEL : value[field as keyof CharacterProfile]
          return (
            <div key={field}>
              <label style={labelStyle}>{labels[field]}</label>
              <select
                value={selectValue}
                onChange={e => {
                  if (e.target.value === OTHER_SENTINEL) {
                    setOtherMode(prev => ({ ...prev, [field]: true }))
                    setField(field as keyof CharacterProfile, '')
                  } else {
                    setOtherMode(prev => ({ ...prev, [field]: false }))
                    setField(field as keyof CharacterProfile, e.target.value)
                  }
                }}
                disabled={disabled}
                style={fieldStyle}
                required={['gender', 'age', 'ethnicity', 'hair'].includes(field)}
              >
                <option value="">Choose…</option>
                {OPTIONS[field].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value={OTHER_SENTINEL}>Other (specify)…</option>
              </select>
              {useOther && (
                <input
                  type="text"
                  value={value[field as keyof CharacterProfile]}
                  onChange={e => setField(field as keyof CharacterProfile, e.target.value)}
                  disabled={disabled}
                  placeholder={placeholders[field]}
                  style={{
                    ...fieldStyle,
                    marginTop: '6px',
                    cursor: 'text',
                  }}
                  autoFocus
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Save as influencer — the name is held by the parent and the save
          fires once the hero frame is picked, so the character lands in
          My influencers WITH their picture. */}
      {onSaveNameChange && (
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg)',
          borderRadius: 'var(--r-md)',
          border: '1px dashed var(--border)',
        }}>
          <input
            type="text"
            placeholder="Name this character to save them to My influencers…"
            value={saveName ?? ''}
            onChange={e => onSaveNameChange(e.target.value)}
            disabled={disabled}
            style={{ ...fieldStyle, width: '100%', cursor: 'text' }}
          />
          {(saveName ?? '').trim() && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 6, fontStyle: 'italic' }}>
              They&apos;ll be saved with their photo once you pick a frame and generate.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

