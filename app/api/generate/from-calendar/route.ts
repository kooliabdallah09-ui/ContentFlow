import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);

  try {
    const { date, contentType, title, description, platforms } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's brand profile (most recent one)
    const { data: brandProfiles, error: brandError } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const brandProfile = brandProfiles?.[0];

    if (brandError || !brandProfile) {
      console.error("Brand profile fetch error:", brandError);
      console.error("User ID:", userData.user.id);
      return Response.json(
        {
          error: "Brand profile not set up. Please configure your brand in Settings first.",
          debug: brandError?.message || "No brand profile found"
        },
        { status: 400 }
      );
    }

    // Generate content based on content type
    const client = new Anthropic();
    let generatedContent = "";

    if (contentType === "video") {
      // Generate video script
      const prompt = `You are a professional copywriter. Generate a compelling video script for a ${contentType} for ${brandProfile.company_name}.

Brand: ${brandProfile.company_name}
Description: ${brandProfile.description}
Target Audience: ${brandProfile.target_audience}
Brand Voice: ${brandProfile.tone_of_voice}
Suggested Title: ${title}
Content Description: ${description}
Platforms: ${platforms.join(", ")}

Generate a 30-60 second video script that:
1. Opens with a hook (first 2 seconds must grab attention)
2. Presents the main message clearly
3. Includes a call-to-action
4. Matches the brand voice
5. Is optimized for the platforms listed

Return ONLY the script text, no additional formatting.`;

      const message = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const textContent = message.content.find((c) => c.type === "text");
      if (textContent && textContent.type === "text") {
        generatedContent = textContent.text;
      }
    } else if (contentType === "social") {
      // Generate social post
      const prompt = `You are a social media expert. Generate a compelling social media post for ${brandProfile.company_name}.

Brand: ${brandProfile.company_name}
Description: ${brandProfile.description}
Target Audience: ${brandProfile.target_audience}
Brand Voice: ${brandProfile.tone_of_voice}
Suggested Title: ${title}
Content Description: ${description}
Platforms: ${platforms.join(", ")}

Generate a social post that:
1. Is engaging and conversational
2. Includes relevant emojis
3. Has a strong call-to-action
4. Fits within character limits for the platforms
5. Matches the brand voice

Return ONLY the post text, no additional formatting.`;

      const message = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const textContent = message.content.find((c) => c.type === "text");
      if (textContent && textContent.type === "text") {
        generatedContent = textContent.text;
      }
    } else if (contentType === "blog") {
      // Generate blog post
      const prompt = `You are a professional content writer. Generate a compelling blog post outline for ${brandProfile.company_name}.

Brand: ${brandProfile.company_name}
Description: ${brandProfile.description}
Target Audience: ${brandProfile.target_audience}
Brand Voice: ${brandProfile.tone_of_voice}
Suggested Title: ${title}
Content Description: ${description}

Generate a blog post outline (not full article) with:
1. Title
2. Hook/Introduction (2-3 sentences)
3. 3-4 main sections with bullet points
4. Conclusion with CTA
5. 2-3 SEO keywords to naturally incorporate

Return as a structured outline that the user can expand.`;

      const message = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });

      const textContent = message.content.find((c) => c.type === "text");
      if (textContent && textContent.type === "text") {
        generatedContent = textContent.text;
      }
    }

    return Response.json({
      content: generatedContent,
      contentType,
      title,
      description,
      date,
    });
  } catch (err) {
    console.error("Error generating content:", err);
    return Response.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
