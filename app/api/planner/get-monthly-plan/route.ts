import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: planData, error: planError } = await supabase
      .from("user_monthly_plans")
      .select("plan_data")
      .eq("user_id", userData.user.id)
      .eq("month", month)
      .eq("year", year)
      .single();

    if (planError) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = typeof planData.plan_data === "string"
      ? JSON.parse(planData.plan_data)
      : planData.plan_data;

    return Response.json({ plan });
  } catch (err) {
    console.error("Error fetching plan:", err);
    return Response.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}
