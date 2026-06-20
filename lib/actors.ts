import type { CharacterProfile } from './character'

// Curated library of UGC actors. Users pick one and the full CharacterProfile
// is dropped into the orchestrate call — same downstream path as the custom
// CharacterBuilder, just with pre-defined values.
//
// `portrait` is a path under /public/actors/. Portraits are generated once by
// scripts/generate-actor-portraits.ts and committed to the repo so the picker
// loads instantly with zero API cost.

export interface Actor {
  id: string
  name: string
  tagline: string         // 3-5 word vibe descriptor for the card
  portrait: string        // /actors/<id>.jpg
  profile: CharacterProfile
}

export const ACTORS: Actor[] = [
  {
    id: 'maya',
    name: 'Maya',
    tagline: 'Skincare & beauty',
    portrait: '/actors/maya.jpg',
    profile: {
      gender: 'Woman',
      age: 'Early 20s',
      ethnicity: 'Northern European',
      hair: 'Brown straight-wavy',
      uniqueFeatures: 'Freckles',
      scene: 'Well-decorated bedroom',
      mood: 'Engaged',
      outfit: 'White tank top',
      accessories: 'Necklace',
    },
  },
  {
    id: 'liam',
    name: 'Liam',
    tagline: 'Tech & lifestyle',
    portrait: '/actors/liam.jpg',
    profile: {
      gender: 'Man',
      age: 'Late 20s',
      ethnicity: 'Northern European',
      hair: 'Dark brown wavy',
      uniqueFeatures: 'Beard',
      scene: 'Living room',
      mood: 'Confident',
      outfit: 'Casual t-shirt',
      accessories: 'Glasses',
    },
  },
  {
    id: 'amara',
    name: 'Amara',
    tagline: 'Wellness & yoga',
    portrait: '/actors/amara.jpg',
    profile: {
      gender: 'Woman',
      age: 'Early 30s',
      ethnicity: 'West African',
      hair: 'Black coily / afro',
      uniqueFeatures: 'None',
      scene: 'Yoga studio',
      mood: 'Chill',
      outfit: 'Yoga set',
      accessories: 'None',
    },
  },
  {
    id: 'diego',
    name: 'Diego',
    tagline: 'Fitness & gym',
    portrait: '/actors/diego.jpg',
    profile: {
      gender: 'Man',
      age: 'Late 20s',
      ethnicity: 'Latin American',
      hair: 'Black straight',
      uniqueFeatures: 'Tattoo visible',
      scene: 'Gym',
      mood: 'Energetic',
      outfit: 'Athletic wear',
      accessories: 'None',
    },
  },
  {
    id: 'noah',
    name: 'Noah',
    tagline: 'Street & streetwear',
    portrait: '/actors/noah.jpg',
    profile: {
      gender: 'Man',
      age: 'Early 20s',
      ethnicity: 'Mixed',
      hair: 'Dark brown curly',
      uniqueFeatures: 'Piercing',
      scene: 'City street',
      mood: 'Confident',
      outfit: 'Streetwear',
      accessories: 'Cap',
    },
  },
  {
    id: 'leila',
    name: 'Leila',
    tagline: 'Café & lifestyle',
    portrait: '/actors/leila.jpg',
    profile: {
      gender: 'Woman',
      age: 'Late 20s',
      ethnicity: 'Middle Eastern',
      hair: 'Dark brown straight',
      uniqueFeatures: 'None',
      scene: 'Café',
      mood: 'Curious',
      outfit: 'Smart casual',
      accessories: 'Earrings',
    },
  },
  {
    id: 'marcus',
    name: 'Marcus',
    tagline: 'Dad-vibe & relatable',
    portrait: '/actors/marcus.jpg',
    profile: {
      gender: 'Man',
      age: '40s',
      ethnicity: 'Black / African American',
      hair: 'Black coily / afro',
      uniqueFeatures: 'Beard',
      scene: 'Living room',
      mood: 'Relaxed',
      outfit: 'Sweater',
      accessories: 'None',
    },
  },
  {
    id: 'sophie',
    name: 'Sophie',
    tagline: 'Skincare & everyday life',
    portrait: '/actors/sophie.jpg',
    profile: {
      gender: 'Woman',
      age: 'Early 20s',
      ethnicity: 'Northern European',
      hair: 'Light brown straight',
      uniqueFeatures: 'None',
      scene: 'Bathroom',
      mood: 'Candid',
      outfit: 'Oversized hoodie',
      accessories: 'Earrings',
    },
  },
  {
    id: 'jin',
    name: 'Jin',
    tagline: 'Minimal & polished',
    portrait: '/actors/jin.jpg',
    profile: {
      gender: 'Man',
      age: 'Early 30s',
      ethnicity: 'East Asian',
      hair: 'Black straight',
      uniqueFeatures: 'None',
      scene: 'Kitchen',
      mood: 'Candid',
      outfit: 'Button-up shirt',
      accessories: 'Watch',
    },
  },
  {
    id: 'isabela',
    name: 'Isabela',
    tagline: 'Tech & creator life',
    portrait: '/actors/isabela.jpg',
    profile: {
      gender: 'Woman',
      age: 'Late 20s',
      ethnicity: 'Northern European',
      hair: 'Blonde wavy',
      uniqueFeatures: 'Freckles',
      scene: 'Home office',
      mood: 'Excited',
      outfit: 'Oversized hoodie',
      accessories: 'Necklace',
    },
  },
]

export function getActor(id: string): Actor | undefined {
  return ACTORS.find(a => a.id === id)
}
