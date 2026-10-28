// Hook formulas: proven opening structures for short UGC ads. A formula is a
// shape, not wording. Each batch gets a different formula per script so the
// openings don't all sound alike. The examples are from made-up products and
// exist only to show the shape. The writer must never copy them.

export interface HookFormula {
  key: string
  label: string
  pattern: string
  examples: [string, string]
}

export const HOOK_FORMULAS: HookFormula[] = [
  {
    key: 'secret',
    label: 'The thing nobody says',
    pattern: 'Reveal something about the category that people rarely admit or are never told.',
    examples: ['Nobody tells you your pillow is the reason your neck hurts.', 'The cheap part of a candle is the part that decides if it smells good.'],
  },
  {
    key: 'stop-buying',
    label: 'Stop buying',
    pattern: 'Tell the viewer to stop doing or buying the usual thing, with one specific reason.',
    examples: ['Stop buying phone cases that crack in a month.', 'Stop wrapping gifts in paper that tears. Do this instead.'],
  },
  {
    key: 'switched',
    label: 'I switched and',
    pattern: 'A personal before/after in one sentence: what I used to do, what I do now, one concrete difference.',
    examples: ['I swapped my morning coffee for this and the 3pm crash stopped.', 'I stopped ironing shirts the day I found this.'],
  },
  {
    key: 'wrong-about',
    label: 'You are doing it wrong',
    pattern: 'Say a common habit is wrong in a way that is slightly insulting but fixable.',
    examples: ['You are storing your cables wrong and that is why they tangle.', 'Everyone washes their face first. That is the mistake.'],
  },
  {
    key: 'tiny-detail',
    label: 'The weird detail',
    pattern: 'Open on one odd, specific detail of the product that makes people ask "wait, what?".',
    examples: ['This mug has a second handle and it is the best idea ever.', 'The lid on this bottle does something I did not expect.'],
  },
  {
    key: 'price-of-problem',
    label: 'What the problem costs',
    pattern: 'Make the cost of the old way concrete: time, money, annoyance. Use only numbers the product info supports.',
    examples: ['I lost an hour every Sunday to this.', 'How many socks have you thrown away because of one hole?'],
  },
  {
    key: 'confession',
    label: 'Confession',
    pattern: 'Admit something slightly embarrassing or surprising, then turn it into the reason for the product.',
    examples: ['I am embarrassed how long I put up with this.', 'I bought three of these before I admitted I needed it.'],
  },
  {
    key: 'direct-challenge',
    label: 'Challenge',
    pattern: 'Dare the viewer to try or notice something right now, with a tiny action.',
    examples: ['Look at your hands. Do they look like this by 3pm?', 'Try this once and tell me you do not feel the difference.'],
  },
  {
    key: 'wrong-guess',
    label: 'Guess the price/use',
    pattern: 'Make the viewer guess what something is or does, then reveal it fast. Do not state a price unless given.',
    examples: ['Guess what this little thing does.', 'This looks like a plain jar. Watch what happens when I open it.'],
  },
  {
    key: 'for-someone',
    label: 'If you are...',
    pattern: 'Call out one very specific kind of person in the first words so they feel singled out.',
    examples: ['If you hate doing dishes, this is for you.', 'Anyone who has ever lost an earbud, watch this.'],
  },
  {
    key: 'objection-flip',
    label: 'The doubt',
    pattern: 'Say the viewer\'s exact doubt out loud in their own words, then flip it with one fact from the product.',
    examples: ['I thought a reusable bottle would be a pain. It was the opposite.', 'Yes it looks simple. That is the point.'],
  },
  {
    key: 'gift',
    label: 'Gift angle',
    pattern: 'Frame it as the answer to "what do I get this person?" with a reason it lands.',
    examples: ['Still need a gift for the person who has everything?', 'The one gift that never ends up in a drawer.'],
  },
]

// Phrases that make a script read like an ad. The writer is told to avoid
// them and the checker rejects scripts that contain them.
export const HOOK_BANNED = [
  'game changer', 'game-changer', 'changed my life', 'you need this', 'you need to see this',
  'you won\'t believe', 'i was skeptical', 'i was so skeptical', 'life hack', 'obsessed',
  'must have', 'must-have', 'hear me out', 'trust me', 'run, don\'t walk', 'link in bio',
  'best thing ever', 'take your', 'elevate', 'unlock', 'next level', 'revolutionary',
]

// Full-script examples of the voice and layout. Not for copying.
export const HOOK_VOICE_EXAMPLES = `Example A (a phone stand):
[BACKGROUND: kitchen counter, morning light]

[HOOK — 0:00 to 0:01]
(creator holds the phone upside down and lets it slip from her hand)
"Stop propping your phone on a mug."

[BODY — 0:01 to 0:04]
(she sets the stand on the counter and the phone clicks in)
"This holds it at any angle and it does not wobble."

[CTA — 0:04 to 0:5]
(she taps the stand once)
"Get one before your next video call."

Example B (a lemon soda):
[BACKGROUND: office desk, afternoon]

[HOOK — 0:00 to 0:01]
(creator stares at the clock, then at the camera)
"Three o'clock. Again."

[BODY — 0:01 to 0:04]
(she cracks the can and takes a sip)
"Basil and lemon, no sugar crash. I drink this instead."

[CTA — 0:04 to 0:5]
(she holds the can up)
"Try the lemon one first."`
