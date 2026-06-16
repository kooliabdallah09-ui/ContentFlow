'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

// Character profile fields — answers feed directly into the Nano Banana hero-frame prompt
// (used as Sora 2's input_reference). Mirrors the questions from the AI Influencer skill.
export interface CharacterProfile {
  gender: string
  age: string
  ethnicity: string
  hair: string
  uniqueFeatures: string
  scene: string
  mood: string
  outfit: string
  accessories: string
}

export interface SavedPersona extends CharacterProfile {
  id: string
  name: string
  savedAt: string
}

export const EMPTY_CHARACTER: CharacterProfile = {
  gender: '',
  age: '',
  ethnicity: '',
  hair: '',
  uniqueFeatures: '',
  scene: '',
  mood: '',
  outfit: '',
  accessories: '',
}

// Option sets per question (matches the AI Influencer .md skill verbatim)
const OPTIONS = {
  gender: ['Man', 'Woman', 'Other'],
  age: ['Early 20s', 'Late 20s', 'Early 30s', 'Late 30s', '40s+'],
  ethnicity: ['South Asian', 'East Asian', 'West African', 'Middle Eastern', 'Southern European', 'Latin American', 'Northern European', 'Mixed'],
  hair: ['Black straight', 'Dark brown wavy', 'Dark brown curly', 'Light brown', 'Blonde', 'Red'],
  uniqueFeatures: ['None', 'Freckles', 'Acne', 'A scar', 'Birthmark', 'Gap teeth'],
  scene: ['Bathroom', 'Bedroom', 'Gym', 'City street', 'Café', 'Kitchen'],
  mood: ['Relaxed', 'Candid', 'Confident', 'Laughing', 'Serious', 'Playful'],
  outfit: ['White tank top', 'Oversized hoodie', 'Gym wear', 'Casual t-shirt', 'Smart casual'],
  accessories: ['None', 'Sunglasses', 'Earrings', 'Necklace', 'Watch', 'Hat', 'Rings'],
}

const PERSONA_STORAGE_KEY = 'contentflow_personas_v1'

interface CharacterBuilderProps {
  value: CharacterProfile
  onChange: (value: CharacterProfile) => void
  disabled?: boolean
}

export default function CharacterBuilder({ value, onChange, disabled }: CharacterBuilderProps) {
  const [personas, setPersonas] = useState<SavedPersona[]>([])
  const [saveAs, setSaveAs] = useState('')
  const [selectedPersonaId, setSelectedPersonaId] = useState('')

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
          return (
            <div key={field}>
              <label style={labelStyle}>{labels[field]}</label>
              <select
                value={value[field]}
                onChange={e => setField(field, e.target.value)}
                disabled={disabled}
                style={fieldStyle}
                required={['gender', 'age', 'ethnicity', 'hair'].includes(field)}
              >
                <option value="">Choose…</option>
                {OPTIONS[field].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
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

// Build the Nano Banana character prompt from a profile. Falls back gracefully when fields are missing.
export function buildCharacterPrompt(profile: CharacterProfile): string {
  const parts: string[] = []
  if (profile.age) parts.push(profile.age.toLowerCase())
  if (profile.ethnicity) parts.push(profile.ethnicity.toLowerCase())
  if (profile.gender) parts.push(profile.gender.toLowerCase() === 'man' ? 'man' : profile.gender.toLowerCase() === 'woman' ? 'woman' : 'person')
  const intro = parts.length ? parts.join(' ') : 'a real person'

  const details: string[] = []
  if (profile.hair) details.push(`${profile.hair.toLowerCase()} hair`)
  if (profile.uniqueFeatures && profile.uniqueFeatures !== 'None') details.push(profile.uniqueFeatures.toLowerCase())
  if (profile.outfit) details.push(`wearing a ${profile.outfit.toLowerCase()}`)
  if (profile.accessories && profile.accessories !== 'None') details.push(`with ${profile.accessories.toLowerCase()}`)
  if (profile.mood) details.push(`${profile.mood.toLowerCase()} energy`)

  const realismAnchors = 'real skin texture with pores and slight imperfections, natural hair with flyaways, candid mid-expression — not a polished portrait'

  return `${intro}${details.length ? ', ' + details.join(', ') : ''}, ${realismAnchors}`
}
