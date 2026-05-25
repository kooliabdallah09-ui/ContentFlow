-- Ensure user_monthly_plans table has proper RLS
ALTER TABLE public.user_monthly_plans ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to see only their own plans
CREATE POLICY "Users can view their own monthly plans" ON public.user_monthly_plans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy for users to insert their own plans
CREATE POLICY "Users can insert their own monthly plans" ON public.user_monthly_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy for users to update their own plans
CREATE POLICY "Users can update their own monthly plans" ON public.user_monthly_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy for users to delete their own plans
CREATE POLICY "Users can delete their own monthly plans" ON public.user_monthly_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- Ensure brand_profiles has RLS
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brand profiles" ON public.brand_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brand profiles" ON public.brand_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brand profiles" ON public.brand_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
