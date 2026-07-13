import type { CharacterProfile } from './character'

// Curated library of UGC actors. Users pick one and the full CharacterProfile
// is dropped into the orchestrate call — same downstream path as the custom
// CharacterBuilder, just with pre-defined values.
//
// `portrait` is a path under /public/actors/. Portraits are generated once by
// scripts/generate-actor-portraits.mjs and committed to the repo so the picker
// loads instantly with zero API cost. Descriptor fields below MUST stay in
// sync with the entries in that script.

export interface Actor {
  id: string
  name: string
  tagline: string         // 3-5 word vibe descriptor for the card
  portrait: string        // /actors/<id>.jpg
  profile: CharacterProfile
}

export const ACTORS: Actor[] = [
  // Personal-care / bathroom / vanity
  {
    id: 'maya',
    name: 'Maya',
    tagline: 'Skincare & fresh-morning',
    portrait: '/actors/maya.jpg',
    profile: {
      gender: 'Woman', age: 'Early 20s', ethnicity: 'Northern European',
      hair: 'Chestnut wavy shoulder-length', uniqueFeatures: 'Freckles',
      scene: 'Bright modern bathroom', mood: 'Fresh',
      outfit: 'White ribbed tank top', accessories: 'None',
    },
  },
  {
    id: 'sophie',
    name: 'Sophie',
    tagline: 'Breezy & effortless',
    portrait: '/actors/sophie.jpg',
    profile: {
      gender: 'Woman', age: 'Early 20s', ethnicity: 'Northern European',
      hair: 'Blonde beach waves', uniqueFeatures: 'Dimples',
      scene: 'Sunny minimalist bedroom', mood: 'Soft',
      outfit: 'Oversized cream hoodie', accessories: 'None',
    },
  },
  {
    id: 'zara',
    name: 'Zara',
    tagline: 'Beauty & polished',
    portrait: '/actors/zara.jpg',
    profile: {
      gender: 'Woman', age: 'Early 20s', ethnicity: 'East Asian',
      hair: 'Jet-black straight with bangs', uniqueFeatures: 'Dewy skin',
      scene: 'Chic apartment vanity', mood: 'Candid',
      outfit: 'Cropped white tee', accessories: 'Small stud earrings',
    },
  },

  // Kitchen / cook
  {
    id: 'jin',
    name: 'Jin',
    tagline: 'Minimal & refined',
    portrait: '/actors/jin.jpg',
    profile: {
      gender: 'Man', age: 'Late 20s', ethnicity: 'East Asian',
      hair: 'Short black side-parted', uniqueFeatures: 'None',
      scene: 'Modern minimalist kitchen', mood: 'Candid',
      outfit: 'Light-blue linen button-up', accessories: 'None',
    },
  },
  {
    id: 'elena',
    name: 'Elena',
    tagline: 'Kitchen & home cook',
    portrait: '/actors/elena.jpg',
    profile: {
      gender: 'Woman', age: 'Mid-20s', ethnicity: 'Mediterranean',
      hair: 'Dark brown curly shoulder-length', uniqueFeatures: 'High cheekbones',
      scene: 'Rustic Tuscan-style kitchen', mood: 'Warm',
      outfit: 'Linen apron over white tee', accessories: 'None',
    },
  },
  {
    id: 'hana',
    name: 'Hana',
    tagline: 'Wellness & morning',
    portrait: '/actors/hana.jpg',
    profile: {
      gender: 'Woman', age: 'Late 20s', ethnicity: 'East Asian',
      hair: 'Long warm brown straight', uniqueFeatures: 'None',
      scene: 'Scandinavian minimalist kitchen with plants', mood: 'Serene',
      outfit: 'Oversized cream linen shirt', accessories: 'Delicate necklace',
    },
  },
  {
    id: 'oliver',
    name: 'Oliver',
    tagline: 'European charm',
    portrait: '/actors/oliver.jpg',
    profile: {
      gender: 'Man', age: 'Mid-20s', ethnicity: 'Northern European',
      hair: 'Light brown, effortlessly styled', uniqueFeatures: 'Sharp jawline',
      scene: 'Sun-drenched Mediterranean apartment kitchen', mood: 'Relaxed',
      outfit: 'Ivory henley shirt', accessories: 'None',
    },
  },

  // Living room / hangout
  {
    id: 'marcus',
    name: 'Marcus',
    tagline: 'Cozy & stylish',
    portrait: '/actors/marcus.jpg',
    profile: {
      gender: 'Man', age: 'Early 20s', ethnicity: 'Black / African American',
      hair: 'Short well-shaped coily', uniqueFeatures: 'Sharp jawline',
      scene: 'Warm living room with wool throw', mood: 'Relaxed',
      outfit: 'Oatmeal knit crewneck', accessories: 'Small gold stud earring',
    },
  },
  {
    id: 'carlos',
    name: 'Carlos',
    tagline: 'Charismatic & easy',
    portrait: '/actors/carlos.jpg',
    profile: {
      gender: 'Man', age: 'Mid-20s', ethnicity: 'Latin American',
      hair: 'Short black modern taper', uniqueFeatures: 'Short well-kept beard',
      scene: 'Leafy backyard patio at golden hour', mood: 'Warm',
      outfit: 'Olive henley shirt', accessories: 'None',
    },
  },

  // Home office / work
  {
    id: 'liam',
    name: 'Liam',
    tagline: 'Rooftop & chill',
    portrait: '/actors/liam.jpg',
    profile: {
      gender: 'Man', age: 'Late 20s', ethnicity: 'Northern European',
      hair: 'Dark brown wavy', uniqueFeatures: 'Short well-groomed beard',
      scene: 'Golden-hour rooftop terrace', mood: 'Confident',
      outfit: 'Charcoal crewneck', accessories: 'None',
    },
  },
  {
    id: 'isabela',
    name: 'Isabela',
    tagline: 'Creator & cozy',
    portrait: '/actors/isabela.jpg',
    profile: {
      gender: 'Woman', age: 'Early 20s', ethnicity: 'Latin American',
      hair: 'Dark brown wavy, glossy', uniqueFeatures: 'Warm smile',
      scene: 'Cozy plant-filled home office', mood: 'Warm',
      outfit: 'Ribbed knit turtleneck', accessories: 'None',
    },
  },
  {
    id: 'priya',
    name: 'Priya',
    tagline: 'Tech & polished',
    portrait: '/actors/priya.jpg',
    profile: {
      gender: 'Woman', age: 'Late 20s', ethnicity: 'South Asian',
      hair: 'Long straight glossy black', uniqueFeatures: 'Sharp cheekbones',
      scene: 'Bright airy home office', mood: 'Confident',
      outfit: 'Silk camisole and cardigan', accessories: 'Small hoop earrings',
    },
  },
  {
    id: 'naomi',
    name: 'Naomi',
    tagline: 'Editorial & sophisticated',
    portrait: '/actors/naomi.jpg',
    profile: {
      gender: 'Woman', age: 'Late 20s', ethnicity: 'Black / African American',
      hair: 'Natural coily medium-length', uniqueFeatures: 'Radiant skin',
      scene: 'Chic loft office with exposed brick', mood: 'Confident',
      outfit: 'Fitted ribbed cream turtleneck', accessories: 'Gold hoop earrings',
    },
  },

  // Café / outdoor lifestyle
  {
    id: 'leila',
    name: 'Leila',
    tagline: 'Café & warm',
    portrait: '/actors/leila.jpg',
    profile: {
      gender: 'Woman', age: 'Mid-20s', ethnicity: 'Middle Eastern',
      hair: 'Long dark brown with subtle balayage', uniqueFeatures: 'Long lashes',
      scene: 'Outdoor café patio with bougainvillea', mood: 'Curious',
      outfit: 'Soft camel-tone knit top', accessories: 'Small gold earrings',
    },
  },
  {
    id: 'mia',
    name: 'Mia',
    tagline: 'Student & sweet',
    portrait: '/actors/mia.jpg',
    profile: {
      gender: 'Woman', age: 'Early 20s', ethnicity: 'Southeast Asian',
      hair: 'Long dark brown straight, glossy', uniqueFeatures: 'Doe eyes',
      scene: 'Coffee-shop window seat', mood: 'Curious',
      outfit: 'Cropped cardigan over tank', accessories: 'Cross-body strap',
    },
  },
  {
    id: 'kai',
    name: 'Kai',
    tagline: 'Coastal & easy',
    portrait: '/actors/kai.jpg',
    profile: {
      gender: 'Man', age: 'Mid-20s', ethnicity: 'Pacific Islander',
      hair: 'Medium wavy black, effortless', uniqueFeatures: 'Sun-kissed tan skin',
      scene: 'Beach-house patio with palms', mood: 'Chill',
      outfit: 'Unbuttoned linen shirt over tee', accessories: 'Thin cord necklace',
    },
  },
  {
    id: 'noah',
    name: 'Noah',
    tagline: 'Streetwear & cool',
    portrait: '/actors/noah.jpg',
    profile: {
      gender: 'Man', age: 'Early 20s', ethnicity: 'Mixed race',
      hair: 'Dark brown curly, textured', uniqueFeatures: 'Small ear piercing',
      scene: 'Dusk city street with neon glow', mood: 'Confident',
      outfit: 'Black bomber over hoodie', accessories: 'Black cap',
    },
  },

  // Fitness
  {
    id: 'diego',
    name: 'Diego',
    tagline: 'Athlete & magnetic',
    portrait: '/actors/diego.jpg',
    profile: {
      gender: 'Man', age: 'Late 20s', ethnicity: 'Latin American',
      hair: 'Black, longer on top', uniqueFeatures: 'Arm tattoo, athletic build',
      scene: 'Sun-drenched rooftop outdoor gym', mood: 'Confident',
      outfit: 'Grey athletic tank', accessories: 'None',
    },
  },
  {
    id: 'jamal',
    name: 'Jamal',
    tagline: 'Fitness & focused',
    portrait: '/actors/jamal.jpg',
    profile: {
      gender: 'Man', age: 'Late 20s', ethnicity: 'Black / African American',
      hair: 'Clean low fade', uniqueFeatures: 'Sharp jawline, neat goatee',
      scene: 'Modern home gym', mood: 'Focused',
      outfit: 'Fitted black athletic tank', accessories: 'Sport watch',
    },
  },
  {
    id: 'amara',
    name: 'Amara',
    tagline: 'Wellness & radiant',
    portrait: '/actors/amara.jpg',
    profile: {
      gender: 'Woman', age: 'Late 20s', ethnicity: 'West African',
      hair: 'Natural black afro', uniqueFeatures: 'Radiant skin',
      scene: 'Sun-drenched yoga studio', mood: 'Chill',
      outfit: 'Matching sage-green yoga set', accessories: 'None',
    },
  },
]

export function getActor(id: string): Actor | undefined {
  return ACTORS.find(a => a.id === id)
}
