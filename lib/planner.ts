import Anthropic from "@anthropic-ai/sdk";
import { FormatPreferences, buildFormatInstruction } from "@/lib/planConfig";

export interface BrandContext {
  name?: string
  description?: string
  productType?: string
  targetAudience?: string
  toneOfVoice?: string
  uniqueValue?: string
  brandMission?: string
  customerPainPoints?: string
  screenshotCount?: number
  keyFeatures?: string
}

export interface DailySuggestion {
  date: string;
  day: string;
  contentType: "video" | "image" | "voice" | "blog" | "social" | "ugc";
  title: string;
  description: string;
  icon: string;
  platforms: string[];
  suggestedTime: string;
  reason: string;
  completed: boolean;
}

export interface MonthlyPlan {
  userId: string;
  month: number;
  year: number;
  industry: string;
  audience: string;
  platforms: string[];
  frequency: "light" | "moderate" | "heavy";
  days: DailySuggestion[];
  createdAt: string;
}

export async function generateMonthlyPlan(
  industry: string,
  platforms: string[],
  frequency: "light" | "moderate" | "heavy",
  audience?: string,
  formatPreferences?: FormatPreferences,
  brand?: BrandContext
): Promise<DailySuggestion[]> {
  const client = new Anthropic();

  const frequencyMap = {
    light: "2-3 posts per week",
    moderate: "3-5 posts per week",
    heavy: "5-7 posts per week",
  };

  const formatInstruction = formatPreferences ? buildFormatInstruction(formatPreferences) : ''
  const hasScreenshots = (brand?.screenshotCount ?? 0) > 0

  const brandSection = brand ? `
BRAND CONTEXT (use this to make every content idea specific and real — never generic):
- Brand name: ${brand.name || 'Unknown'}
- Product type: ${brand.productType || industry}
- What it does: ${brand.description || 'Not specified'}
- Target audience: ${brand.targetAudience || audience || 'General'}
- Tone of voice: ${brand.toneOfVoice || 'Professional'}
- Unique value: ${brand.uniqueValue || 'Not specified'}
- Mission: ${brand.brandMission || 'Not specified'}
- Customer pain points solved: ${brand.customerPainPoints || 'Not specified'}
${hasScreenshots ? `- App screenshots available: YES (${brand.screenshotCount} screenshots provided — you CAN suggest content showing the actual app interface)` : '- App screenshots available: NO — do NOT suggest content that requires showing the app interface visually'}
${brand.keyFeatures ? `- Key screens/features: ${brand.keyFeatures}` : ''}` : ''

  const toolCapabilities = `
CONTENT TOOLS — what ContentFlow's AI generators actually produce (be strictly accurate):

━━ "ugc" → HeyGen AI Avatar (talking head video)
   WHAT IT ACTUALLY IS: A pre-built AI character (not the user, not a real human) reads a script on camera with a branded background.
   CAN produce: avatar speaking a script, text overlays, call-to-action screens, background visuals
   CANNOT produce: real human footage, screen recordings, unboxing, real customer reactions, anything requiring real-world footage
   CANNOT show: actual app UI, real product, real people — avatar is purely synthetic
   CONTENT IDEAS THAT WORK: "Avatar explains why [brand] solves [pain point]", "Avatar announces new feature", "Avatar walks through 3 key benefits"
   CONTENT IDEAS THAT DO NOT WORK: "Show customer using the product", "Record yourself explaining X", "Screen capture the dashboard"

━━ "video" → HeyGen AI video (scripted marketing video)
   WHAT IT ACTUALLY IS: AI-generated short video — animated text, transitions, background footage, voiceover. NOT a screen recorder.
   CAN produce: scripted narrative with text + voiceover, animated titles, stock-style background clips, brand colors
   CANNOT produce: real screen recordings, real product demos, actual app UI, live action footage
   ${hasScreenshots
     ? `Screenshots ARE available (${brand?.screenshotCount}) — you MAY suggest using them as background/overlay in the video`
     : `NO screenshots available — do NOT suggest showing the app interface in any video`}
   CONTENT IDEAS THAT WORK: "Animated explainer: how [brand] works in 3 steps", "Text-driven motivational clip with brand colors"
   CONTENT IDEAS THAT DO NOT WORK: "Show the app being used", "Screen recording of onboarding flow"

━━ "image" → Flux Pro AI image generation
   WHAT IT ACTUALLY IS: Generates a photorealistic or stylistic image from a text description. Cannot replicate specific UIs.
   CAN produce: lifestyle photos (people using devices/products), concept art, branded backgrounds, illustrated mockups, abstract visuals
   CANNOT produce: accurate rendering of a specific app's screens, exact product photos, real people's faces
   CONTENT IDEAS THAT WORK: "Person working on laptop in modern office", "Minimalist device mockup with gradient", "Abstract visual representing productivity"
   CONTENT IDEAS THAT DO NOT WORK: "Screenshot of the ContentFlow dashboard", "Photo of our product page"

━━ "social" → Claude AI text generation (no visuals)
   WHAT IT ACTUALLY IS: A written post — text only, no image attached by default.
   CAN produce: tips, threads, polls, quotes, questions, carousels (text outline), announcements, listicles
   CANNOT produce: any visual content on its own
   CONTENT IDEAS THAT WORK: "5 content mistakes killing your reach", "Poll: what's your biggest content struggle?", "Hot take: consistency beats virality"

━━ "blog" → Claude AI long-form article
   WHAT IT ACTUALLY IS: A full written article (500–2000 words).
   CAN produce: tutorials, comparisons, opinion pieces, case studies, SEO posts, how-to guides
   CANNOT produce: visual content, videos, infographics
   CONTENT IDEAS THAT WORK: "The complete guide to repurposing content", "Why AI content tools are changing marketing in 2026"

━━ "voice" → ElevenLabs AI text-to-speech
   WHAT IT ACTUALLY IS: An AI voice reads a script. Audio file only — no video, no visuals at all.
   CAN produce: podcast-style audio clips, audio tips, voice notes, spoken announcements
   CANNOT produce: anything visual — pure audio output
   CONTENT IDEAS THAT WORK: "60-second audio tip on content strategy", "Weekly voice note from the brand"
   CONTENT IDEAS THAT DO NOT WORK: "Show the product in action", anything requiring a visual

━━ "email" → Claude AI email/newsletter
   WHAT IT ACTUALLY IS: Written email content ready to send via any email platform.
   CAN produce: welcome sequences, weekly newsletters, product announcements, promotional emails, re-engagement
   CANNOT produce: visual designs — text content only

━━ GLOBAL RULES (never break these):
   1. Never suggest "record yourself", "film a video", "take a photo" — the user is not recording anything manually
   2. Never suggest showing the real app interface unless screenshots are available (${hasScreenshots ? 'AVAILABLE ✓' : 'NOT AVAILABLE ✗'})
   3. Never suggest real customer testimonials or UGC from real users — this is all AI-generated
   4. Every suggestion must be 100% achievable with only the tools listed above and the brand info provided
   5. If a great idea requires something unavailable (e.g. real footage), adapt it to what IS possible instead`

  const prompt = `You are an expert content strategist creating a 30-day content calendar.
${brandSection}
${toolCapabilities}

TASK: Generate a 30-day content plan for ${brand?.name || `a ${industry} business`}.

Requirements:
- Posting frequency: ${frequencyMap[frequency]}
- Platforms: ${platforms.join(", ")}
- Build a narrative arc: Week 1 (introduce brand/problem), Week 2 (educate/value), Week 3 (showcase/proof), Week 4 (convert/CTA)
- Leave 1-2 rest/buffer days
${formatInstruction ? `- ${formatInstruction}` : '- Vary content types — avoid same type 2 days in a row'}
- Every title and description must be SPECIFIC to ${brand?.name || 'this brand'} — never generic placeholders
- If suggesting video/ugc that shows the app: only do so when hasScreenshots = ${hasScreenshots}

TITLE RULES — this is critical:
- Every title MUST reference ${brand?.name || 'the brand'} OR a specific benefit / pain point / feature you were told about above
- NEVER use generic labels like "Product Demo", "Audio Tip", "Quick Tip", "Educational Post" — those are placeholders, not titles
- Good examples (specific): "How ${brand?.name || '[brand]'} cuts your ${brand?.customerPainPoints?.split(',')[0]?.trim() || 'busywork'} in half", "Three reasons ${brand?.name || '[brand]'} feels different on day one"
- Bad examples (generic): "Product showcase", "Customer story", "Quick tip"
- The title should make someone scrolling stop and want to read the description

For each content day return JSON:
{
  "date": "2026-06-01",
  "day": "Monday",
  "contentType": "ugc",
  "title": "Specific title that mentions ${brand?.name || 'the brand'} or a concrete benefit/pain point",
  "description": "Exactly what to create — specific visuals, script direction, key message (2-3 sentences)",
  "icon": "short label",
  "platforms": ["Instagram", "TikTok"],
  "suggestedTime": "7pm",
  "reason": "Why this format and topic on this day"
}

Return ONLY a valid JSON array. No markdown. No extra text.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Strip markdown code fences if Claude added them despite the instruction,
    // then locate the first '[' and last ']' as a robust JSON-array boundary.
    let jsonStr = content.text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')
    if (start === -1 || end === -1 || end <= start) {
      console.error('[planner] Claude returned non-JSON output. First 300 chars:', jsonStr.slice(0, 300))
      throw new Error('Planner response did not contain a JSON array')
    }
    jsonStr = jsonStr.slice(start, end + 1)
    const plan = JSON.parse(jsonStr) as Array<Omit<DailySuggestion, "completed">>;

    // Add completed flag
    return plan.map((day) => ({
      ...day,
      completed: false,
    }));
  } catch (error) {
    // Log the FULL error so we can see what actually went wrong instead of
    // silently degrading to generic "Product Demo / Audio Tip" placeholders.
    console.error("[planner] Failed to generate monthly plan — falling back to generic plan:",
      error instanceof Error ? `${error.name}: ${error.message}` : error)
    // Return default plan if generation fails
    return generateDefaultPlan(platforms, frequency);
  }
}

function generateDefaultPlan(
  platforms: string[],
  frequency: "light" | "moderate" | "heavy"
): DailySuggestion[] {
  const contentTypes: Array<"video" | "image" | "social" | "blog" | "voice" | "ugc"> = [
    "video",
    "image",
    "social",
    "blog",
    "voice",
    "ugc",
  ];

  const contentDescriptions = {
    video: {
      title: "Product Demo",
      description: "Create a short video showing your product or service in action",
      icon: "🎥",
    },
    image: {
      title: "Product Showcase",
      description: "Share a beautiful image of your product or behind-the-scenes moment",
      icon: "📸",
    },
    social: {
      title: "Quick Tip",
      description: "Share a helpful tip or insight for your audience",
      icon: "💡",
    },
    blog: {
      title: "Educational Post",
      description: "Write an educational post or article for your blog",
      icon: "📝",
    },
    voice: {
      title: "Audio Tip",
      description: "Record a short audio message with tips or updates",
      icon: "🎙️",
    },
    ugc: {
      title: "Customer Story",
      description: "Create a customer testimonial or user-generated content piece",
      icon: "⭐",
    },
  };

  const postsPerWeek = frequency === "light" ? 3 : frequency === "moderate" ? 4 : 6;
  const daysWithPosts = new Set<number>();
  const spacing = Math.floor(7 / postsPerWeek);

  // Space out posts throughout the week
  for (let i = 0; i < postsPerWeek; i++) {
    daysWithPosts.add(i * spacing);
  }

  const plan: DailySuggestion[] = [];
  let contentTypeIndex = 0;

  for (let day = 1; day <= 30; day++) {
    const date = new Date(2026, 5, day); // June 2026
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const contentType = contentTypes[contentTypeIndex % contentTypes.length];
    const content = contentDescriptions[contentType];

    plan.push({
      date: `2026-06-${String(day).padStart(2, "0")}`,
      day: dayName,
      contentType,
      title: content.title,
      description: content.description,
      icon: content.icon,
      platforms,
      suggestedTime: `${7 + (day % 12)}pm`,
      reason: "Suggested as part of your content strategy",
      completed: false,
    });

    if (daysWithPosts.has((day - 1) % 7)) {
      contentTypeIndex++;
    }
  }

  return plan;
}

export function getDayFromPlan(
  plan: MonthlyPlan,
  dateStr: string
): DailySuggestion | undefined {
  return plan.days.find((day) => day.date === dateStr);
}

export function updateDayStatus(
  plan: MonthlyPlan,
  dateStr: string,
  completed: boolean
): MonthlyPlan {
  return {
    ...plan,
    days: plan.days.map((day) =>
      day.date === dateStr ? { ...day, completed } : day
    ),
  };
}

export function getWeekPlan(plan: MonthlyPlan, weekNumber: number): DailySuggestion[] {
  const startDay = (weekNumber - 1) * 7 + 1;
  const endDay = weekNumber * 7;

  return plan.days.filter((day) => {
    const day_num = parseInt(day.date.split("-")[2]);
    return day_num >= startDay && day_num <= endDay;
  });
}

export function getCompletionStats(plan: MonthlyPlan) {
  const completed = plan.days.filter((d) => d.completed).length;
  const total = plan.days.length;

  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}
