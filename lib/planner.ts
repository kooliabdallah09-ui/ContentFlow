import Anthropic from "@anthropic-ai/sdk";

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
  audience?: string
): Promise<DailySuggestion[]> {
  const client = new Anthropic();

  const frequencyMap = {
    light: "2-3 posts per week",
    moderate: "3-5 posts per week",
    heavy: "5-7 posts per week",
  };

  const audienceText = audience ? `targeting ${audience}` : "for their target audience";
  const prompt = `Generate a 30-day social media content plan for a ${industry} business ${audienceText}.

Requirements:
- Posting frequency: ${frequencyMap[frequency]}
- Platforms: ${platforms.join(", ")}
- Content types to use: video (short demo/testimonial), image (product/lifestyle), voice (podcast/tips), blog (educational), social (quick tips), ugc (user-generated/customer stories)
- Create variety - don't repeat same type 2 days in a row
- Build a narrative arc: Week 1 (introduce), Week 2 (educate), Week 3 (showcase), Week 4 (convert)
- Include 2-3 UGC days spread throughout
- Leave 1-2 flexible buffer days

For each day, provide JSON with:
{
  "date": "2026-06-01",
  "day": "Monday",
  "contentType": "video",
  "title": "Brief title",
  "description": "What the content should show/say (2-3 sentences)",
  "icon": "emoji",
  "platforms": ["Instagram", "TikTok"],
  "suggestedTime": "7pm",
  "reason": "Why this content on this day"
}

Return ONLY a JSON array of 30 objects, no markdown formatting, no extra text.`;

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
