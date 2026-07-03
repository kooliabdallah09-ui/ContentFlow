import type { SupabaseClient } from '@supabase/supabase-js'

export interface BrandContext {
  companyName?: string
  description?: string
  productType?: string
  uniqueValueProp?: string
  brandMission?: string
  targetAudience?: string
  customerPainPoints?: string
  toneOfVoice?: string
  products?: string
}

export async function loadBrandContext(supabase: SupabaseClient, userId: string): Promise<BrandContext | null> {
  const fullCols = 'company_name, description, product_type, unique_value_prop, brand_mission, target_audience, customer_pain_points, tone_of_voice, products'
  const { data, error } = await supabase
    .from('brand_profiles')
    .select(fullCols)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // Retry without newer columns in case migration not run
    const { data: fallback } = await supabase
      .from('brand_profiles')
      .select('company_name, description, unique_value_prop, brand_mission, target_audience, tone_of_voice')
      .eq('user_id', userId)
      .maybeSingle()
    if (!fallback) return null
    return mapRow(fallback)
  }
  if (!data) return null
  return mapRow(data)
}

function mapRow(row: Record<string, unknown>): BrandContext {
  return {
    companyName: (row.company_name as string) || undefined,
    description: (row.description as string) || undefined,
    productType: (row.product_type as string) || undefined,
    uniqueValueProp: (row.unique_value_prop as string) || undefined,
    brandMission: (row.brand_mission as string) || undefined,
    targetAudience: (row.target_audience as string) || undefined,
    customerPainPoints: (row.customer_pain_points as string) || undefined,
    toneOfVoice: (row.tone_of_voice as string) || undefined,
    products: typeof row.products === 'string' ? row.products : row.products ? JSON.stringify(row.products) : undefined,
  }
}

/** Format brand context as a prompt block. Returns empty string if no context. */
export function formatBrandPrompt(ctx: BrandContext | null): string {
  if (!ctx) return ''
  const lines: string[] = []
  if (ctx.companyName) lines.push(`- Brand: ${ctx.companyName}`)
  if (ctx.productType) lines.push(`- Product type: ${ctx.productType}`)
  if (ctx.description) lines.push(`- What it does: ${ctx.description}`)
  if (ctx.uniqueValueProp) lines.push(`- Unique value: ${ctx.uniqueValueProp}`)
  if (ctx.brandMission) lines.push(`- Mission / goal: ${ctx.brandMission}`)
  if (ctx.targetAudience) lines.push(`- Target audience: ${ctx.targetAudience}`)
  if (ctx.customerPainPoints) lines.push(`- Pain points solved: ${ctx.customerPainPoints}`)
  if (ctx.toneOfVoice) lines.push(`- Brand tone of voice: ${ctx.toneOfVoice}`)
  if (ctx.products) lines.push(`- Products in catalog: ${ctx.products}`)

  if (lines.length === 0) return ''

  return `\nBRAND CONTEXT (use this to make the output specific to the brand — never generic):\n${lines.join('\n')}\n\nEvery piece of copy must reflect this brand. Reference the brand name, actual benefits, and real pain points where relevant. Never write generic "sign up now" or "boost your business" filler — always tie it back to what this brand actually does.\n`
}
