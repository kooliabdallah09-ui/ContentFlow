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
CONTENT TOOLS — capabilities and hard limits (strictly follow these):

"ugc" → HeyGen AI Avatar video
  CAN: AI avatar speaks to camera, text overlays, branded backgrounds, call-to-action
  CANNOT: show real app interface or screenshots — avatar is just talking/presenting
  GOOD FOR: announcements, testimonials, brand voice, explaining a concept out loud
  EXAMPLE for ${brand?.name || 'this brand'}: Avatar explains the top 3 benefits, avatar reacts to a customer result

"video" → Short-form video (Reels/TikTok/YouTube Shorts style)
  CAN: screen recordings, app walkthroughs, demo footage, text overlays, B-roll
  REQUIRES SCREENSHOTS/RECORDINGS: only suggest showing the app if hasScreenshots = ${hasScreenshots}
  GOOD FOR: product demos, tutorials, before/after, feature reveals
  EXAMPLE: ${hasScreenshots ? `Screen recording of ${brand?.name || 'the app'} dashboard with voiceover` : 'Animated text video explaining a key benefit'}

"image" → AI-generated image (Flux Pro)
  CAN: lifestyle photography, concept visuals, branded mockups, abstract backgrounds, people using devices
  CANNOT: accurately render a specific app's UI or exact screen
  GOOD FOR: mood/lifestyle content, quote cards, product concept art
  EXAMPLE: Person on laptop in a café, device mockup with gradient background

"social" → Text-based post (no image generation involved)
  CAN: tips, threads, polls, quotes, questions, announcements, listicles
  GOOD FOR: engagement, community building, shareability
  EXAMPLE: "3 things I wish I knew before starting content marketing"

"blog" → Long-form written article
  CAN: tutorials, comparisons, case studies, opinion pieces, SEO content
  GOOD FOR: organic traffic, authority building, email content
  EXAMPLE: "How ${brand?.name || 'we'} helped a brand grow to 10k followers in 30 days"

"voice" → AI voice/audio clip (ElevenLabs)
  CAN: spoken tips, podcast snippets, audio announcements
  CANNOT: show anything visual — audio only
  GOOD FOR: podcast teasers, audio tips, voice notes for social

"email" → Email/newsletter
  CAN: feature announcements, weekly roundups, nurture sequences, promotions
  GOOD FOR: retention, upsell, community updates`

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

For each content day return JSON:
{
  "date": "2026-06-01",
  "day": "Monday",
  "contentType": "ugc",
  "title": "Specific, actionable title",
  "description": "Exactly what to create — specific visuals, script direction, key message (2-3 sentences)",
  "icon": "short label",
  "platforms": ["Instagram", "TikTok"],
  "suggestedTime": "7pm",
  "reason": "Why this format and topic on this day"
}

Return ONLY a valid JSON array. No markdown. No extra text.`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-7",
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

    // Parse the JSON response
    const jsonStr = content.text.trim();
    const plan = JSON.parse(jsonStr) as Array<Omit<DailySuggestion, "completed">>;

    // Add completed flag
    return plan.map((day) => ({
      ...day,
      completed: false,
    }));
  } catch (error) {
    console.error("Failed to generate monthly plan:", error);
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
