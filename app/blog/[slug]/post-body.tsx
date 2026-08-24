// Post content rendered via typed React components. Not markdown — we want
// full control over pull quotes, code-like example blocks, and typography.
// Each post is a self-contained switch case here.

const P: React.CSSProperties = { margin: '0 0 20px', fontSize: 17, lineHeight: 1.75 }
const H2: React.CSSProperties = {
  fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 28,
  lineHeight: 1.2, letterSpacing: '-0.01em', margin: '48px 0 18px',
}
const H3: React.CSSProperties = {
  fontWeight: 700, fontSize: 18, lineHeight: 1.3, margin: '32px 0 12px',
}
const QUOTE: React.CSSProperties = {
  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
  fontSize: 22, lineHeight: 1.4, color: 'var(--ink)',
  borderLeft: '2px solid var(--ink)', padding: '4px 0 4px 24px',
  margin: '32px 0',
}
const EX_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--ink-dim)',
  fontFamily: 'var(--font-mono)', marginBottom: 6,
}
const EX_BOX: React.CSSProperties = {
  background: 'var(--surface-2, rgba(0,0,0,0.03))',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '18px 22px',
  margin: '14px 0 24px',
  fontSize: 15.5,
  lineHeight: 1.65,
}

export function PostBody({ slug }: { slug: string }) {
  if (slug === 'why-your-ai-ugc-ad-looks-like-an-ai-ugc-ad') {
    return <WhyAIUgcAdLooksLikeOne />
  }
  return <p style={P}>Post not found.</p>
}

function WhyAIUgcAdLooksLikeOne() {
  return (
    <article>
      <p style={{ ...P, fontSize: 20, color: 'var(--ink)', lineHeight: 1.6 }}>
        You can spot an AI-generated UGC ad within three seconds. It&apos;s almost never the visuals that give it away —
        video models got good this year. It&apos;s the script. And once you see the pattern, you can&apos;t unsee it.
      </p>

      <p style={P}>
        We spent the better part of two weeks re-engineering the script side of our own pipeline after a friend
        showed me an ad we generated and said, kindly, &quot;this reads like AI wrote it.&quot; She was right. So we
        went through every ad in our library, catalogued what was wrong, and rebuilt the prompt from scratch.
        Here&apos;s what we found.
      </p>

      <h2 style={H2}>The six tells</h2>

      <p style={P}>
        Every AI-generated UGC ad we studied had at least three of these. Most had five. Once you name them,
        they&apos;re unmistakable.
      </p>

      <h3 style={H3}>1. Feature listing with commas</h3>
      <p style={P}>
        A real person naming four features in a row is instant AI-tell. Nobody talks like this. Nobody has ever
        talked like this.
      </p>
      <div style={EX_BOX}>
        <div style={EX_LABEL}>Bad</div>
        &quot;It does script, voiceover, captions, and B-roll.&quot;
        <div style={{ ...EX_LABEL, marginTop: 14 }}>Good</div>
        &quot;I typed one sentence and it just… made the whole video.&quot;
      </div>

      <h3 style={H3}>2. The Recap Body</h3>
      <p style={P}>
        The body of the ad summarises the product instead of describing one moment the creator had with it. This
        is the ad-writer instinct leaking through. Real UGC is a specific 15-second window in someone&apos;s week,
        not a value-prop deck.
      </p>
      <div style={EX_BOX}>
        <div style={EX_LABEL}>Bad</div>
        &quot;This tool makes ads in two minutes with one brand profile.&quot;
        <div style={{ ...EX_LABEL, marginTop: 14 }}>Good</div>
        &quot;I made this on my lunch break. Like — actual lunch break. Fifteen minutes.&quot;
      </div>

      <h3 style={H3}>3. Ad-copy CTAs</h3>
      <p style={P}>
        &quot;Yeah, I&apos;m in.&quot; &quot;You have to try it.&quot; &quot;This is the one.&quot; These lines have never been said out loud
        by a person, only written by marketers pretending to be one. A real CTA sounds like a friend&apos;s aside,
        not a marketer&apos;s close.
      </p>
      <div style={EX_BOX}>
        <div style={EX_LABEL}>Bad</div>
        &quot;Yeah, I&apos;m in.&quot;
        <div style={{ ...EX_LABEL, marginTop: 14 }}>Good</div>
        &quot;I mean — I&apos;m not going back to Canva after this.&quot;
      </div>

      <h3 style={H3}>4. The &quot;so I discovered&quot; opening</h3>
      <p style={P}>
        Nobody starts a real conversation with a soft product reveal. &quot;So I&apos;ve been using this new tool…&quot; is the
        conversational equivalent of &quot;dear valued customer.&quot; The best UGC openings are a specific problem in
        progress: a time, a place, a mid-thought.
      </p>

      <h3 style={H3}>5. Adjective triples and AI-word soup</h3>
      <p style={P}>
        &quot;Amazing, incredible, game-changing.&quot; &quot;Genuinely,&quot; &quot;actually,&quot; &quot;literally the best.&quot; &quot;Finally, a
        [product] that [does thing].&quot; These are the words the model reaches for when it has nothing specific to
        say. Which is most of the time, unless you engineer the prompt to force specificity.
      </p>

      <h3 style={H3}>6. The polite realisation</h3>
      <p style={P}>
        This one is subtle. It&apos;s the fake-composed reveal moment — &quot;(matter-of-fact) &apos;Contentflow does it
        all…&apos;&quot; — where a stage direction spells out the emotion the model wants the viewer to feel. Real
        reactions are messier. People laugh, sigh, side-eye, exhale. They say &quot;wait — what.&quot; They don&apos;t
        deliver.
      </p>

      <h2 style={H2}>What real UGC actually sounds like</h2>

      <p style={P}>
        We looked at thousands of high-performing organic UGC posts to figure out what was different. It came
        down to five things.
      </p>

      <p style={P}>
        <strong>Openings are fragments.</strong> Not thesis statements — half-thoughts, mid-sentences, weirdly
        personal admissions. &quot;Guys I&apos;m gonna get fired.&quot; (pause) &quot;…just kidding, I&apos;m ten ads ahead of
        schedule.&quot; The hook works because it&apos;s a mystery — you&apos;re watching to find out what happens next,
        not because someone told you what the video is about.
      </p>

      <p style={P}>
        <strong>Bodies have one specific moment.</strong> A time, a smell, a coworker&apos;s name, a tab count, a
        dollar amount, a physical gesture. Details that couldn&apos;t come from a marketer. &quot;I opened my laptop at
        9:04. It&apos;s 9:11. There are three finished ads on my desktop. I don&apos;t understand what&apos;s happening but
        I love it.&quot;
      </p>

      <p style={P}>
        <strong>There&apos;s always one physical beat.</strong> A sip, a shrug, a squint, a long pause. The
        creator&apos;s body confirms what the words are trying to say. Without it, the copy floats.
      </p>

      <p style={P}>
        <strong>CTAs are shrugs, not asks.</strong> &quot;It&apos;s free to start, so.&quot; &quot;I don&apos;t know, man. Just try
        it.&quot; &quot;(shrugs) I mean. Yeah.&quot; The viewer converts because they were already going to; the CTA gives
        them permission to close the tab and go do it.
      </p>

      <p style={P}>
        <strong>The shape of the ad changes.</strong> Not every UGC ad is a problem-agitate-solve. Some are
        confessions. Some are rants. Some are cold opens to a story. Some are the creator arguing with an
        unseen skeptic. Variety at the structural level is what makes a feed of UGC not feel like a feed of
        UGC.
      </p>

      <div style={QUOTE}>
        Every AI-generated line has to pass a test: could a marketer have written this exact sentence for a
        landing page? If the answer is yes, rewrite until it&apos;s no.
      </div>

      <h2 style={H2}>The seven angles we rotate through</h2>

      <p style={P}>
        Our script generator picks one of seven creative frames at random for every ad, and commits to it. This
        one change fixed more &quot;AI feel&quot; than any prompt engineering we&apos;d done before it.
      </p>

      <p style={P}>
        <strong>Mid-use reaction.</strong> The creator is already using the product when the camera catches
        them. No setup, no problem statement — a reaction to what just happened, then one specific detail
        about what surprised them, then a throwaway line about not going back.
      </p>

      <p style={P}>
        <strong>Confessional.</strong> A weirdly personal admission that has nothing to do with the product for
        the first beat, then the product enters as the thing that fixed the embarrassing situation.
        Vulnerable, specific, uncomfortable-honest.
      </p>

      <p style={P}>
        <strong>Arguing with someone off-screen.</strong> The creator is defending the product to an unseen
        skeptic (&quot;no listen —&quot; &quot;I&apos;m telling you —&quot;). Feels like the middle of a real conversation. The CTA
        is them giving up trying to convince and shrugging.
      </p>

      <p style={P}>
        <strong>Rant / genuine annoyance.</strong> Annoyed at the OLD way — competitor by name if relevant, or
        the workflow itself. Product is the relief valve. Delivered fast, dry, a little pissed off.
      </p>

      <p style={P}>
        <strong>Slow reveal.</strong> Starts with a hyper-specific weird sentence that makes no sense until the
        last two seconds. Payoff is the product being what caused the weirdness. Confusion, then
        oh.
      </p>

      <p style={P}>
        <strong>Storytime cold open.</strong> Starts mid-story like they&apos;re texting a friend. &quot;Okay so —&quot;
        &quot;You&apos;re not gonna believe —&quot;. Zero preamble. The story is the ad.
      </p>

      <p style={P}>
        <strong>Direct-camera challenge.</strong> Cocky, playful, borderline confrontational. Points at the
        lens. Dares the viewer to prove them wrong. High energy, short sentences.
      </p>

      <h2 style={H2}>What to do this week if you&apos;re making UGC ads</h2>

      <p style={P}>
        If you&apos;re running AI-generated UGC in your ad account right now and want it to stop feeling like
        AI-generated UGC, here&apos;s the minimum viable fix:
      </p>

      <p style={P}>
        <strong>1. Ban six words from your prompts.</strong> &quot;Amazing,&quot; &quot;incredible,&quot; &quot;game-changer,&quot;
        &quot;genuinely,&quot; &quot;actually,&quot; &quot;finally.&quot; The model reaches for them when it&apos;s cornered. Explicit bans
        force better word choice.
      </p>

      <p style={P}>
        <strong>2. Force one specific detail per script.</strong> A time. A name. A dollar amount. A physical
        gesture. A tab count. The exact thing a marketer wouldn&apos;t have invented. If your ad doesn&apos;t have
        one, rewrite it.
      </p>

      <p style={P}>
        <strong>3. Cut the CTA in half.</strong> If your CTA is a full sentence, it&apos;s probably ad copy. Great
        UGC CTAs are shrugs. &quot;It&apos;s free. Do what you want.&quot; &quot;I mean, try it.&quot; That&apos;s the whole close.
      </p>

      <p style={P}>
        <strong>4. Rotate the shape.</strong> If every ad you&apos;ve run this month opens with a problem statement,
        that&apos;s the pattern the algorithm learned to skip. Try a confession. Try a rant. Try a slow reveal. The
        format itself is a variable.
      </p>

      <p style={P}>
        <strong>5. Read every quoted line out loud.</strong> If you can&apos;t say it without sounding like an
        advertisement, the model wrote it for you, not for a person. Rewrite until it fits your own mouth.
      </p>

      <p style={P}>
        The tools got fast this year. The infrastructure got cheap. The only thing left that separates a
        UGC ad that converts from one that gets scrolled past in half a second is whether it sounds like
        a person or a product page. And that, thankfully, is just a prompt problem.
      </p>
    </article>
  )
}
