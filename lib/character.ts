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

// Option lists per field — shared by CharacterBuilder UI and the actor studio.
export const CHARACTER_OPTIONS = {
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
} as const

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomCharacterProfile(): CharacterProfile {
  return {
    gender:         pick(CHARACTER_OPTIONS.gender),
    age:            pick(CHARACTER_OPTIONS.age),
    ethnicity:      pick(CHARACTER_OPTIONS.ethnicity),
    hair:           pick(CHARACTER_OPTIONS.hair),
    uniqueFeatures: pick(CHARACTER_OPTIONS.uniqueFeatures),
    scene:          pick(CHARACTER_OPTIONS.scene),
    mood:           pick(CHARACTER_OPTIONS.mood),
    outfit:         pick(CHARACTER_OPTIONS.outfit),
    accessories:    pick(CHARACTER_OPTIONS.accessories),
  }
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

  // UGC anchors — direct eye contact, warm engaging expression, naturally
  // attractive but real (skin texture preserved). This is what makes UGC feel
  // like a real creator talking to camera, not a bland candid snapshot.
  const realismAnchors = 'looking directly at the camera with confident eye contact, warm slight smile, real individual face with distinctive features and slight asymmetries (NOT the generic AI-influencer template — no plastic-glass skin, no dead-symmetrical features, no over-groomed model face). Skin is clear of active acne / blemishes / rough patches but still has REAL texture (faint pores, tiny freckles, subtle unevenness, natural micro-redness). Natural hair with a few flyaways. Expressive and engaging — like a real attractive friend caught mid-sentence, not a stock-photo influencer'

  return `${intro}${details.length ? ', ' + details.join(', ') : ''}, ${realismAnchors}`
}
