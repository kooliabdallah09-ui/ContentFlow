'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { type CharacterProfile, EMPTY_CHARACTER, buildCharacterPrompt } from '@/lib/character'

export { type CharacterProfile, EMPTY_CHARACTER, buildCharacterPrompt }

export interface SavedPersona extends CharacterProfile {
  id: string
  name: string
  savedAt: string
}

// Option sets per question. Each field also supports an "Other (specify)" free-text input
// for cases the dropdown doesn't cover. Gender intentionally has no "Other" select option —
// it's just 3 choices; non-binary / custom users pick "Other" → text input.
const OPTIONS = {
  gender: ['Man', 'Woman'],
  age: ['Teen (16–19)', 'Early 20s', 'Late 20s', 'Early 30s', 'Late 30s', '40s', '50s', '60+'],
  ethnicity: [
    'South Asian', 'East Asian', 'Southeast Asian', 'Central Asian',
    'West African', 'East African', 'North African',
    'Black / African American', 'Afro-Caribbean',
    'Middle Eastern', 'Persian / Iranian',
    'Southern European', 'Northern European', 'Eastern European / Slavic',
    'Latin American', 'Indigenous / Native American', 'Pacific Islander',
    'Mixed',
  ],
  hair: [
    'Black straight', 'Black wavy', 'Black curly', 'Black coily / afro',
    'Dark brown straight', 'Dark brown wavy', 'Dark brown curly',
    'Light brown straight', 'Light brown wavy',
    'Blonde straight', 'Blonde wavy', 'Platinum blonde', 'Strawberry blonde',
    'Red / auburn',
    'Gray', 'Salt and pepper', 'White',
    'Bald / shaved',
    'Dyed (vibrant colour)',
    'Long braids', 'Dreadlocks',
  ],
  uniqueFeatures: [
    'None', 'Freckles', 'Acne / blemishes', 'A scar', 'Birthmark',
    'Gap teeth', 'Mole on face', 'Beard', 'Mustache', 'Tattoo visible',
    'Glasses', 'Piercing', 'Dimples',
  ],
  scene: [
    'Bathroom', 'Bedroom', 'Living room', 'Kitchen',
    'Home office', 'Closet / dressing room',
    'Gym', 'Yoga studio',
    'Café', 'Restaurant',
    'Outdoor park', 'Beach', 'City street', 'Rooftop',
    'Car interior',
  ],
  mood: [
    'Relaxed', 'Candid', 'Confident', 'Excited',
    'Laughing', 'Surprised', 'Skeptical', 'Curious',
    'Serious', 'Playful', 'Chill', 'Energetic',
  ],
  outfit: [
    'White tank top', 'Casual t-shirt', 'Oversized hoodie', 'Sweater',
    'Athletic wear', 'Gym wear', 'Yoga set', 'Sports bra',
    'Smart casual', 'Suit / blazer', 'Dress', 'Skirt + top',
    'Pajamas / loungewear', 'Robe', 'Towel',
    'Streetwear', 'Cropped top', 'Button-up shirt',
  ],
  accessories: [
    'None', 'Sunglasses', 'Glasses', 'Earrings', 'Necklace',
    'Watch', 'Bracelet', 'Rings',
    'Hat', 'Cap', 'Beanie', 'Headband',
    'Scarf', 'Headphones',
  ],
}

const PERSONA_STORAGE_KEY = 'contentflow_personas_v1'

interface CharacterBuilderProps {
  value: CharacterProfile
  onChange: (value: CharacterProfile) => void
  disabled?: boolean
}

const OTHER_SENTINEL = '__OTHER__'

export default function CharacterBuilder({ value, onChange, disabled }: CharacterBuilderProps) {
  const [personas, setPersonas] = useState<SavedPersona[]>([])
  const [saveAs, setSaveAs] = useState('')
  const [selectedPersonaId, setSelectedPersonaId] = useState('')
  // Tracks which fields the user explicitly switched into "Other" mode this session.
  // We also detect "Other" implicitly if the saved value isn't in the predefined options.
  const [otherMode, setOtherMode] = useState<Record<string, boolean>>({})

  const isOtherActive = (field: keyof typeof OPTIONS): boolean => {
    if (otherMode[field]) return true
    const v = value[field as keyof CharacterProfile]
    return !!v && !OPTIONS[field].includes(v)
  }

  // Load saved personas from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSONA_STORAGE_KEY)
      if (raw) setPersonas(JSON.parse(raw))
    } catch {}
  }, [])

  const persistPersonas = (next: SavedPersona[]) => {
    setPersonas(next)
    try { localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  const loadPersona = (id: string) => {
    setSelectedPersonaId(id)
    if (!id) return
    const p = personas.find(p => p.id === id)
    if (!p) return
    const { id: _id, name: _name, savedAt: _savedAt, ...character } = p
    void _id; void _name; void _savedAt
    onChange(character)
  }

  const savePersona = () => {
    const name = saveAs.trim()
    if (!name) return
    const requiredAnswered = value.gender && value.age && value.ethnicity && value.hair
    if (!requiredAnswered) return
    const newPersona: SavedPersona = {
      ...value,
      id: `p_${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
    }
    persistPersonas([newPersona, ...personas])
    setSaveAs('')
    setSelectedPersonaId(newPersona.id)
  }

  const deletePersona = (id: string) => {
    if (!confirm('Delete this persona?')) return
    persistPersonas(personas.filter(p => p.id !== id))
    if (selectedPersonaId === id) setSelectedPersonaId('')
  }

  const setField = (k: keyof CharacterProfile, v: string) => {
    onChange({ ...value, [k]: v })
    // Modifying after loading a saved persona — clear the selection so the user knows they're editing
    if (selectedPersonaId) setSelectedPersonaId('')
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
      {/* Saved personas picker */}
      {personas.length > 0 && (
        <div style={{
          padding: '12px',
          background: 'var(--bg)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
        }}>
          <label style={labelStyle}>Saved Personas</label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select
              value={selectedPersonaId}
              onChange={e => loadPersona(e.target.value)}
              disabled={disabled}
              style={{ ...fieldStyle, flex: 1 }}
            >
              <option value="">— Build new character below —</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedPersonaId && (
              <button
                type="button"
                onClick={() => deletePersona(selectedPersonaId)}
                disabled={disabled}
                title="Delete this persona"
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  color: 'var(--bad)',
                }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        </div>
      )}

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

      {/* Save as persona */}
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'center',
        padding: '10px 12px',
        background: 'var(--bg)',
        borderRadius: 'var(--r-md)',
        border: '1px dashed var(--border)',
      }}>
        <input
          type="text"
          placeholder="Name this persona to save…"
          value={saveAs}
          onChange={e => setSaveAs(e.target.value)}
          disabled={disabled}
          style={{ ...fieldStyle, flex: 1, cursor: 'text' }}
        />
        <button
          type="button"
          onClick={savePersona}
          disabled={disabled || !saveAs.trim() || !value.gender || !value.age || !value.ethnicity || !value.hair}
          className="btn btn-ghost"
          style={{ fontSize: '12px', padding: '8px 14px' }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

