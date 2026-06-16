// Shared (non-client) character types + prompt builder.
// Lives outside CharacterBuilder.tsx so server routes can import without dragging in React.

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
