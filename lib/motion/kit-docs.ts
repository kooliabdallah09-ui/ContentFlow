// The motion kit's API, as the writer model sees it. It's the model's only
// reference for '@motion-kit', so it must match lib/motion/kit/ exactly —
// update both together.

export const KIT_DOCS = `## @motion-kit reference

All positions are in pixels. x / y are always the element's CENTER (Character can use its feet instead, see anchor).
Sizes are in pixels on the real canvas (min edge 1080). Colors are kit names — teal, coral, yellow, purple, pink, blue, green, orange, white, gray, ink, paper — or any CSS hex color.
Components that take \`at\` animate themselves in at that frame (relative to their Sequence) and render nothing before it.

### Layout
- <Stage background?="paper" dots?=true>children</Stage> — cream paper with a faint dot grid and the kit font. Wrap the whole ad in exactly one Stage.
- <Ground y /> — full-width ink line (the floor).
- <Camera zoom focusX? focusY?>children</Camera> — zooms everything inside around a point. Animate zoom (e.g. 1 → 1.15) for push-ins and punch zooms.

### Characters
- <Character x y shape? color? expression? size?=220 anchor?="center"|"bottom" rotate? flip? look?="left"|"right"|"center" bob?=4 squash? crown? mark? seed? opacity? />
  - shape: "robot" | "triangle" | "blob" | "square" | "circle"
  - expression: "neutral" | "happy" | "smug" | "angry" | "shocked" | "dizzy" | "sad" | "determined" | "love" | "wink" — switch it on specific frames to act.
  - size is the body width. anchor="bottom" makes y the feet (use it for anything standing on Ground / Podium / a bar).
  - bob is idle bobbing in px (0 = still). squash: -1 stretched … 1 flattened, for jumps and landings.
  - crown: true puts a gold crown on its head. flip mirrors it (faces left).
  - mark: "!" | "!!" | "?" | "?!" | "sweat" | "stars" (dizzy) | "hearts" | "zzz" — a reaction above the head.
  - seed offsets blink/bob so two characters don't move in sync.
  Characters blink and bob on their own. Move them by animating x / y / rotate from the frame.

### App UI (the story happens inside interfaces)
- <AppWindow x y width height title? badge? at?>children</AppWindow> — desktop window with a 76px title bar. Children are positioned inside the body: (0,0) is the body's top-left, so a child's x/y are relative to it (body height = height - 76).
- <ChatInput x y width text? placeholder? progress? /> — 88px-tall chat bar. progress 0→1 types \`text\` out.
- <SpeechBubble x y text tail?="down-left"|"down-right"|"left"|"right"|"none" at? size?=50 maxWidth?=760 color? /> — sizes to its text and wraps at maxWidth (keep it to a few words). x / y is the bubble's center, so leave room for its full width. Pops in at \`at\`.
- <RaceBar x y width value color? rank? label? height?=70 /> — leaderboard bar. value 0–1 is the fill (animate it). rank shows a #n badge on the left (#1 is gold).
- raceBarTip(x, width, value, hasRank?=true) → x of the fill's leading edge, to stand a character on the bar (anchor="bottom", y = barY - 35).
- <RankBadge x y rank size?=76 />
- <Slider x y width value leftColor? rightColor? /> and sliderKnobX(x, width, value) → knob x.
- <Rope from={[x,y]} to={[x,y]} sag?=40 color? thickness? /> — sagging rope (tug-of-war, leashes).
- <Pill x y text color? filled?=true at? size?=36 /> — pill button / tag.
- <PhoneFrame x y height?=900 at?>children</PhoneFrame> — phone outline; children are positioned inside the screen.

### Payoffs
- <Podium x y width?=640 /> — 2 | 1 | 3 steps standing on y (its bottom edge).
- podiumSpots(x, y, width?) → { first, second, third }, each { x, y } — where feet go (use anchor="bottom").
- <Burst x y text size?=260 color?="yellow" at? rotate? /> — comic starburst ("BONK!", "WOW", "-50%"). Text shrinks to fit.
- <Banner x y text at? color?="ink" textColor?="yellow" size?=72 rotate? /> — the "NEW #1" moment.
- <Confetti at? count?=70 duration?=90 seed? /> — full-screen confetti shower.
- <Counter x y to from?=0 at? duration?=30 prefix? suffix? decimals? size?=120 color? /> — number counting up (prices, stats, "10x").
- <Checklist x y items={[...]} at? stagger?=12 size?=44 color?="green" /> — ticks items off one by one.

### Ad copy & brand
- <Caption x y text size?=84 color? highlight?={["word"]} highlightColor?="coral" at? stagger?=3 maxWidth?=920 align?="center"|"left" /> — big headline, words pop in one by one. "\\n" breaks lines. highlight colors matching words (case-insensitive).
- <ProductShot x y src size?=440 at? rotate?=-3 fit?="cover"|"contain" /> — image on a white card with a hard shadow. Renders nothing if src is null.
- <Logo x y src? text? size?=120 at? /> — the logo image, or \`text\` as a wordmark when src is null.
- <CtaButton x y text color?="coral" at? pressAt? size?=58 /> — the call-to-action button; it visibly gets pressed at pressAt.

### Sound
- <Music volume?=0.55 /> — the ad's soundtrack (chosen for you, faded in and out). Put exactly one inside the Stage, before the scenes. Renders nothing when the brief has no music.
- <Sfx name at volume?=1 /> — a one-shot effect at frame \`at\` (relative to its Sequence). Names: "click" (button press, selection), "pop" (something appears: bubbles, cards), "switch" (toggle), "whoosh" (entrances, slides, scene changes), "tick" (checklist item), "type" (one keypress; repeat every 5-6 frames while text types), "impact" (landing, big reveal), "bonk" (comic hit, bursts), "success" (win, payoff, logo), "bong" (soft accent, realisation), "error" (fail, wrong answer), "glitch" (tiny chaotic accent).

### Motion helpers
- pop(frame, at, fps, bounce?=0.6) → 0→1 spring with overshoot starting at \`at\`.
- glide(frame, at, fps) → 0→1 smooth, no overshoot.
- ease(frame, [f0, f1], [v0, v1]) → clamped, eased interpolation.
- <Pop at from?="scale"|"up"|"down"|"left"|"right"|"fade" outAt? bounce?>children</Pop> — animates any group in (and out at outAt). It's a full-canvas layer, so position children absolutely inside it.
- <Float amount?=10 speed?=1 seed?>children</Float> — gentle idle float. <Shake at duration?=12 intensity?=14>children</Shake> — impact rattle.
- COLORS, INK, PAPER, FONT, color(name) → hex.
`
