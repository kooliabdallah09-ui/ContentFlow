// Podcast Ad — 6-shot production template.
//
// Based on the AI Video Bootcamp "GRÜNS Production Guide" reference.
// A ~78s dialogue-driven ad shot in a premium podcast studio with two
// characters (Host + Expert). Shots 1-5 are conversational cuts;
// shot 6 is a product-reveal outro that camera-pulls out and racks focus
// down to the product on a table.
//
// Each shot function returns a fully-formed Seedance 2.0 prompt with:
//   - Locked setting (identical across all 6)
//   - Locked character wardrobe + skin realism
//   - Explicit pacing / gesture / reaction clauses
//   - Filled-in dialogue from the user's script

export interface PodcastCharacter {
  role: 'host' | 'expert'
  name: string
  appearanceLine: string   // "dark wavy shoulder-length hair, olive skin, oatmeal ribbed knit crop top, light-wash denim, seated cross-legged"
}

export interface PodcastScript {
  shot1: { hostLine?: string; expertLine: string; hostLine2?: string; expertLine2?: string }
  shot2: { hostLine: string; expertLine: string; hostLine2: string; expertLine2: string }
  shot3: { hostLine: string; expertLine: string }
  shot4: { hostLine: string; expertLine: string }
  shot5: { hostLine: string; expertLine: string; hostLine2?: string; expertLine2?: string }
  shot6: { expertLine: string; hostLine: string }   // outro: expert teases offer, host reacts
}

export interface PodcastPromptInput {
  host: PodcastCharacter
  expert: PodcastCharacter
  productName: string
  productDescription?: string
  script: PodcastScript
  shotIndex: 1 | 2 | 3 | 4 | 5 | 6
}

const SETTING_BLOCK = `SETTING (fixed, identical in every shot — professional studio light, not a window look): Corner of a premium podcast studio. Soft directional key light from large diffused studio softboxes, neutral clean colour temperature, gentle fill removing harsh shadows — NOT daylight-through-a-window, no visible window, no glare or hot reflection on the wall, ceiling not in frame, clean matte wall finish. Cream boucle sofa/armchair, soft neutral gallery wall with abstract framed art behind. Two RODE mic-arm booms already positioned toward each speaker's mouth — do not reposition them. Natural room tone only: faint fabric rustle, quiet breathing, mic pop on plosives. No music, no score, no reverb on voices.`

const SKIN_REALISM = `SKIN & REALISM: Photoreal skin, visible pores, natural micro-imperfections and asymmetry, NOT airbrushed/glossy/waxy/plastic/CGI-smooth. Irregular natural blinking, never synced between the two. Micro expressions tied to word meaning.`

const AUDIO_UNDER_CUTAWAY = `AUDIO-CONTINUES-UNDER-CUTAWAY: Several cuts below show one woman reacting while the OTHER's dialogue keeps playing uninterrupted underneath — camera glances at the listener mid-sentence, then cuts back. Only the camera changes; lip-sync is accurate only for whoever is actually speaking on screen at that instant. The listener reacts silently — no new words, no invented dialogue.`

const LIVELY_REACTION = `LIVELY REACTION ENERGY (critical): Every reaction cutaway must be visibly, genuinely expressive — real eyebrow movement, real eye engagement, a real half-smile or reaction forming, not a passive blank listening face. Silent reactions must feel as alive as spoken lines. Articulation stays natural and relaxed, normal mouth movement for casual speech, NOT exaggerated wide-open over-articulation. Natural speech rhythm — a small pause or emphasis on a key word here and there, like real friends actually talk, not a flat even monotone.`

const NEGATIVE = `NEGATIVE / AVOID: slow/stretched/padded speech, dead air, plastic skin, waxy skin, glossy CGI look, uncanny valley, frozen or dead-eyed expression, robotic or synchronized blinking, mismatched lip-sync, warped or extra fingers, morphing face, flickering, wardrobe/hairstyle/lighting changing between cuts, window glare on the wall, visible ceiling, text overlays, subtitles, watermark, logos, background music, monotone delivery, stiff mannequin-like stillness, looping/repeated gestures, ANY change to the "RODE" text on either mic boom arm.`

function charBlock(host: PodcastCharacter, expert: PodcastCharacter): string {
  return `CHARACTERS (locked identity, wardrobe, pose, skin — zero restyle across the whole sequence):
@image1 — HOST — ${host.appearanceLine}, RODE mic a few inches from her/his mouth.
@image2 — EXPERT — ${expert.appearanceLine}, RODE mic a few inches from her/his mouth.
${SKIN_REALISM}`
}

function pacingClause(wordCount: number): string {
  if (wordCount > 45) return `PACING PRIORITY (critical): This shot carries dense dialogue (${wordCount} words) — deliver brisk and energetic like two friends talking over each other's excitement, NOT slow. Do not pad or stretch. If ahead of schedule, hold a natural silent beat rather than slowing words down.`
  if (wordCount > 25) return `PACING PRIORITY (critical): Brisk conversational pace, warm and personal in TONE but not slow in TEMPO. Warmth comes from vocal softness and facial expression, not from talking slowly.`
  return `PACING PRIORITY (critical): Brisk natural conversational pace. Never slow or stretched. If a line finishes early, hold a natural silent reaction beat rather than slowing speech.`
}

function countWords(script: PodcastScript, shotIndex: number): number {
  const s = script[`shot${shotIndex}` as keyof PodcastScript] as Record<string, string | undefined>
  return Object.values(s).filter(Boolean).join(' ').split(/\s+/).length
}

// ── Individual shot templates ────────────────────────────────────────

function shot1(i: PodcastPromptInput): string {
  const wc = countWords(i.script, 1)
  const s = i.script.shot1
  return `[SEEDANCE 2.0 — DUO PODCAST · SHOT 1/6 · DURATION 15s · 9:16
${SETTING_BLOCK}
${charBlock(i.host, i.expert)}
${pacingClause(wc)}
${AUDIO_UNDER_CUTAWAY}
GESTURE LOGIC: Every hand movement/head tilt is tied to the specific word being spoken. Eyeline: both people look at each other throughout, never at the lens.
${LIVELY_REACTION}

VISUAL CUT SEQUENCE (open with EXPERT setting up the problem):
0:00–3.0 CAM-B @image2 (EXPERT) delivers her opening line, calm forward lean.
3.0–4.0 CAM-C reaction insert @image1 (HOST) — nodding, half-smile forming.
4.0–7.0 CAM-B back to @image2 continuing.
7.0–9.0 CAM-A @image1 (HOST) replies with playful energy.
9.0–10.0 CAM-B reaction insert @image2 — starting to smile.
10.0–12.0 CAM-VIEW brief wide two-shot — shared laugh, genuine, breath-driven.
12.0–15.0 CAM-B back to @image2 landing the wrap-up line.

DIALOGUE (verbatim — do not add, remove, or paraphrase):
${s.expertLine ? `@image2 (EXPERT, warm American voice, brisk and articulate): "${s.expertLine}"` : ''}
${s.hostLine ? `@image1 (HOST, bright energetic American voice, quick natural cadence): "${s.hostLine}"` : ''}
${s.expertLine2 ? `@image2 (EXPERT): "${s.expertLine2}"` : ''}

${NEGATIVE}]`
}

function shot2(i: PodcastPromptInput): string {
  const wc = countWords(i.script, 2)
  const s = i.script.shot2
  return `[SEEDANCE 2.0 — DUO PODCAST · SHOT 2/6 · DURATION 15s · 9:16
${SETTING_BLOCK}
${charBlock(i.host, i.expert)}
${pacingClause(wc)}
${AUDIO_UNDER_CUTAWAY}
GESTURE LOGIC: Gestures strictly tied to spoken meaning. Eyeline: they look at each other, never at the lens.
${LIVELY_REACTION}

VISUAL CUT SEQUENCE (dense, fast — this is the peak-energy exchange):
0:00–2.5 CAM-A @image1 (HOST) starts the honest confession.
2.5–4.0 CAM-C reaction insert @image2 (EXPERT) — bracing, small smile.
4.0–5.5 CAM-B @image2 echoes / agrees — both break into real breath-driven laughter.
5.5–7.0 CAM-VIEW brief wide two-shot, shared laugh continuing.
7.0–10.5 CAM-A @image1 lists specific complaints.
10.5–11.5 CAM-B reaction insert @image2 nodding.
11.5–15.0 CAM-B @image2 lands the stat / expert insight, calm confident close.

DIALOGUE (verbatim):
@image1 (HOST): "${s.hostLine}"
@image2 (EXPERT): "${s.expertLine}"
@image1 (HOST): "${s.hostLine2}"
@image2 (EXPERT): "${s.expertLine2}"

${NEGATIVE}]`
}

function shot3(i: PodcastPromptInput): string {
  const wc = countWords(i.script, 3)
  const s = i.script.shot3
  return `[SEEDANCE 2.0 — DUO PODCAST · SHOT 3/6 · DURATION 15s · 9:16
${SETTING_BLOCK}
${charBlock(i.host, i.expert)}
${pacingClause(wc)}
${AUDIO_UNDER_CUTAWAY}
GESTURE LOGIC: Open-palm gestures only on the emphasised phrases. Eyeline: looking at each other.
${LIVELY_REACTION}

VISUAL CUT SEQUENCE (product introduction — warmth, agreement):
0:00–3.0 CAM-A @image1 (HOST) transitions with intrigue.
3.0–4.0 CAM-C reaction insert @image2 (EXPERT) — curious raised brow.
4.0–5.5 CAM-A back to @image1 finishing.
5.5–9.5 CAM-B @image2 delivers the product explanation, confident and brisk.
9.5–11.0 CAM-VIEW brief wide two-shot — settling agreement, small nods.
11.0–13.0 CAM-A @image1 close — warm convinced smile (silent reaction).
13.0–15.0 CAM-B @image2 final settle, calm certainty.

DIALOGUE (verbatim):
@image1 (HOST): "${s.hostLine}"
@image2 (EXPERT): "${s.expertLine}"

${NEGATIVE}]`
}

function shot4(i: PodcastPromptInput): string {
  const wc = countWords(i.script, 4)
  const s = i.script.shot4
  return `[SEEDANCE 2.0 — DUO PODCAST · SHOT 4/6 · DURATION 12s · 9:16
${SETTING_BLOCK}
${charBlock(i.host, i.expert)}
${pacingClause(wc)}
${AUDIO_UNDER_CUTAWAY}
GESTURE LOGIC: Body shift natural, not forced. Open-hand gesture only on the emphasis word. Eyeline: looking at each other, warmer and more personal.
${LIVELY_REACTION}

VISUAL CUT SEQUENCE (personal testimonial from HOST):
0:00–3.5 CAM-A @image1 (HOST) shares personal experience, warm and genuine.
3.5–4.5 CAM-C reaction insert @image2 (EXPERT) — warm active listening.
4.5–7.0 CAM-A back to @image1 finishing — soft exhale.
7.0–8.0 CAM-VIEW brief wide two-shot — @image2 leans in warmly.
8.0–10.0 CAM-B @image2 delivers reassuring line, warm tone quick pace.
10.0–12.0 CAM-B back to @image2 with one open-hand gesture on emphasis word, gentle confident smile settling.

DIALOGUE (verbatim):
@image1 (HOST): "${s.hostLine}"
@image2 (EXPERT): "${s.expertLine}"

${NEGATIVE}]`
}

function shot5(i: PodcastPromptInput): string {
  const wc = countWords(i.script, 5)
  const s = i.script.shot5
  return `[SEEDANCE 2.0 — DUO PODCAST · SHOT 5/6 · DURATION 15s · 9:16
${SETTING_BLOCK}
${charBlock(i.host, i.expert)}
${pacingClause(wc)}
${AUDIO_UNDER_CUTAWAY}
GESTURE LOGIC: Every hand movement tied to a specific word. Eyeline: at each other throughout.
${LIVELY_REACTION}

VISUAL CUT SEQUENCE (CTA payoff — highest energy, sudden excitement):
0:00–2.5 CAM-B @image2 (EXPERT) delivers the offer line, relaxed and satisfied.
2.5–4.0 CAM-C reaction insert @image1 (HOST) — building excitement, eyes widening.
4.0–7.0 CAM-A @image1 "wait, actually?" moment — sudden genuine excitement.
7.0–8.5 CAM-B reaction insert @image2 — already starting to laugh.
8.5–11.0 CAM-A back to @image1 finishing, genuine laugh, playful urgency.
11.0–13.0 CAM-B @image2 laughing warmly, shaking head fondly.
13.0–15.0 CAM-VIEW wide two-shot — laughter trailing off naturally, clean end frame for shot 6 to pick up.

DIALOGUE (verbatim):
@image2 (EXPERT): "${s.expertLine}"
@image1 (HOST): "${s.hostLine}"
${s.expertLine2 ? `@image2 (EXPERT): "${s.expertLine2}"` : ''}
${s.hostLine2 ? `@image1 (HOST): "${s.hostLine2}"` : ''}

${NEGATIVE}]`
}

function shot6(i: PodcastPromptInput): string {
  return `[SEEDANCE 2.0 — OUTRO SHOT 6/6 · DURATION 6s · 9:16 · start_image LOCKED
START FRAME (locked — hard constraint): The attached start_image is the exact opening frame — same two people, same exact poses, same exact camera position and framing as that photo. Do not reinterpret. The motion described below begins from that precise composition on frame 1.

CHARACTERS (out-of-focus post-conversation chatter — natural continued body language, NOT idle/frozen):
@image1 (HOST) — glancing down as if checking phone / notes, natural continued back-and-forth energy.
@image2 (EXPERT) — actively gesturing and talking toward @image1, natural hand movement, head tilts, relaxed post-recording chatter.
They continue interacting the entire time, just increasingly out of focus as the camera pulls back — reads as a real behind-the-scenes moment.

CAMERA MOVE (a single continuous handheld operator move with real human imperfection):
The instant the shot starts, the camera pulls back and manually racks out of focus — like a real operator physically stepping back while rolling the focus ring. Handheld micro-shake, slight wobble, uneven acceleration. Studio light stands swim into soft-focus view on both sides, people fall out of focus but keep gesturing/talking. Continued pull-back blends into a downward tilt/crane. A round table swims up into the soft blurred bottom of frame. Camera arcs inward in a smooth-but-human handheld semicircular push toward the product; focus pulls sharply back in and locks crisp on the product as the shot ends.

VISUAL TIMING (6s total):
0:00–0.5 — Sharp on locked start frame, matching the attached photo exactly.
0.5–2.0 — Rapid pull-back + heavy rack-defocus begins, handheld micro-shake visible.
2.0–3.7 — Pull-back blends into downward tilt/crane, table begins rising into blurred lower frame.
3.7–5.0 — Handheld semicircular arc push-in toward table, focus beginning to resolve.
5.0–6.0 — Focus locks sharp on the ${i.productName} product on the table. Clean final beat.

PRODUCT REVEAL: On the table — ${i.productName} placed naturally on a warm wood or light stone surface, product's exact packaging preserved.

AUDIO: No clear scripted dialogue. Natural muffled voices welcome — soft, mostly-indistinct chatter as if wrapping up, occasional half-audible phrase like "${i.script.shot6.expertLine.slice(0, 40)}" or a light laugh, quiet and muffled/distant-sounding since they're out of focus and the camera has physically moved away. Plus quiet room tone, faint fabric sound. Natural and realistic, not clean/close-mic'd. No music, no voiceover.

NEGATIVE / AVOID: perfectly smooth/mechanical zoom or crane move (must feel handheld), light stands rendered sharp/in-focus before the final beat, product appearing in sharp focus too early, product morphing or duplicating, wrong packaging design, people staying in hard focus after pull begins, people going still/frozen/idle in the background (they must keep visibly interacting), clearly intelligible scripted dialogue or precise lip-sync, changing the people's identity/hair/wardrobe from the start frame, text overlays, subtitles, watermark, music, jump cuts.]`
}

export function buildShotPrompt(input: PodcastPromptInput): string {
  switch (input.shotIndex) {
    case 1: return shot1(input)
    case 2: return shot2(input)
    case 3: return shot3(input)
    case 4: return shot4(input)
    case 5: return shot5(input)
    case 6: return shot6(input)
  }
}

export const PODCAST_SHOT_DURATIONS: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 15, 2: 15, 3: 15, 4: 12, 5: 15, 6: 6,
}
