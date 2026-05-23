import { createClient } from "@supabase/supabase-js";
import { generateMonthlyPlan } from "@/lib/planner";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);

  try {
    const {
      industry,
      audience,
      platforms,
      frequency,
    }: {
      industry: string;
      audience: string;
      platforms: string[];
      frequency: "light" | "moderate" | "heavy";
    } = await request.json();

    if (!industry || !audience || !platforms || !frequency) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate the 30-day plan using Claude
    const plan = await generateMonthlyPlan(industry, audience, platforms, frequency);

    // Save to database
    const now = new Date();
    const { data: saved, error: saveError } = await supabase
      .from("user_monthly_plans")
      .insert([
        {
          user_id: userData.user.id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          plan_data: JSON.stringify(plan),
          industry,
          audience,
          platforms,
          frequency,
          status: "active",
          created_at: now.toISOString(),
        },
      ])
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save plan:", saveError);
      return Response.json(
        { error: "Failed to save plan" },
        { status: 500 }
      );
    }

    return Response.json({ plan, planId: saved.id });
  } catch (err) {
    console.error("Error generating plan:", err);
    return Response.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }
}
