import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import DodoPayments from 'dodopayments'

export const maxDuration = 60

// Credits granted per plan per month
const PLAN_CREDITS: Record<string, number> = {
  lite:    300,
  starter: 800,
  pro:     2000,
  agency:  6500,
  enterprise: 25000,
}

// Credits granted per one-time credit pack
const PACK_CREDITS: Record<string, number> = {
  pack_250:  250,
  pack_500:  500,
  pack_1500: 1500,
  pack_5000: 5000,
}

// Build reverse map: Dodo product ID → pack key (checked at runtime so env vars are resolved)
function getProductIdToPackKey(): Record<string, string> {
  const isTest = process.env.DODO_ENV !== 'production'
  const map: Record<string, string> = {}
  for (const packKey of Object.keys(PACK_CREDITS)) {
    const envKey = isTest
      ? `DODO_TEST_${packKey.toUpperCase()}`
      : `DODO_${packKey.toUpperCase()}`
    const productId = process.env[envKey]
    if (productId) map[productId] = packKey
  }
  return map
}

// Build reverse map: Dodo product ID → subscription plan key
function getProductIdToPlanKey(): Record<string, string> {
  const isTest = process.env.DODO_ENV !== 'production'
  const map: Record<string, string> = {}
  for (const planKey of Object.keys(PLAN_CREDITS)) {
    for (const period of ['MONTHLY', 'ANNUAL']) {
      const envKey = isTest
        ? `DODO_TEST_PRODUCT_${planKey.toUpperCase()}_${period}`
        : `DODO_PRODUCT_${planKey.toUpperCase()}_${period}`
      const productId = process.env[envKey]
      if (productId) map[productId] = planKey
    }
  }
  return map
}

// Resolve plan from subscription payload, trying metadata first, then product_id, then DB fallback
async function resolvePlanKey(
  subAny: { metadata?: Record<string, string>; product_id?: string; product_cart?: Array<{ product_id: string }> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string | undefined,
): Promise<string | null> {
  const metaPlan = subAny.metadata?.plan_key
  if (metaPlan && PLAN_CREDITS[metaPlan]) {
    console.log(`[dodo/webhook] resolvePlanKey → ${metaPlan} (via metadata)`)
    return metaPlan
  }

  const productIdMap = getProductIdToPlanKey()
  console.log(`[dodo/webhook] resolvePlanKey product_id=${subAny.product_id} map_keys=${Object.keys(productIdMap).join(',')}`)
  if (subAny.product_id && productIdMap[subAny.product_id]) {
    const p = productIdMap[subAny.product_id]
    console.log(`[dodo/webhook] resolvePlanKey → ${p} (via product_id)`)
    return p
  }

  const cartPlan = subAny.product_cart?.map(i => productIdMap[i.product_id]).find(Boolean)
  if (cartPlan) {
    console.log(`[dodo/webhook] resolvePlanKey → ${cartPlan} (via cart)`)
    return cartPlan
  }

  if (userId) {
    const { data } = await supabase.from('user_credits').select('plan').eq('user_id', userId).maybeSingle()
    if (data?.plan && PLAN_CREDITS[data.plan]) {
      console.log(`[dodo/webhook] resolvePlanKey → ${data.plan} (via DB fallback)`)
      return data.plan
    }
  }
  console.warn(`[dodo/webhook] resolvePlanKey → null (all fallbacks exhausted)`)
  return null
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((v, k) => { headers[k] = v })

  try {
    const dodo = new DodoPayments({
      bearerToken: (process.env.DODO_ENV !== 'production' ? process.env.DODO_TEST_API_KEY : process.env.DODO_API_KEY)!,
      webhookKey: (process.env.DODO_ENV !== 'production' ? process.env.DODO_TEST_WEBHOOK_SECRET : process.env.DODO_WEBHOOK_SECRET)!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

    const event = dodo.webhooks.unwrap(rawBody, { headers })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debugData = event.data as any
    console.log(`[dodo/webhook] event=${event.type} sub_id=${debugData?.subscription_id ?? debugData?.payment_id ?? 'n/a'} product_id=${debugData?.product_id ?? 'n/a'} customer_id=${debugData?.customer_id ?? 'n/a'} metadata=${JSON.stringify(debugData?.metadata ?? {})}`)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    if (event.type === 'subscription.active') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id
      const planKeyRaw = meta?.plan_key

      // Portal-initiated changes have no metadata — fall back to customer_id lookup
      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('dodo_customer_id', subAny.customer_id)
          .maybeSingle()
        userId = found?.user_id
      }

      // Last resort: look up user by email from the subscription's customer info
      const custEmail = subAny.customer?.email ?? subAny.customer_email
      if (!userId && custEmail) {
        const { data: usersData } = await supabase.auth.admin.listUsers()
        const match = usersData?.users?.find(u => u.email?.toLowerCase() === custEmail.toLowerCase())
        userId = match?.id
        if (userId) console.log(`[dodo/webhook] resolved user via email ${custEmail}`)
      }

      if (!userId) {
        console.warn(`[dodo/webhook] subscription.active: could not resolve user. meta=${JSON.stringify(meta)} customer_id=${subAny.customer_id} email=${custEmail}`)
        return NextResponse.json({ ok: true })
      }

      const planKey = (planKeyRaw && PLAN_CREDITS[planKeyRaw]) ? planKeyRaw : await resolvePlanKey(subAny, supabase, userId)
      if (!planKey) {
        console.warn(`[dodo/webhook] subscription.active: could not resolve plan for user ${userId}`)
        return NextResponse.json({ ok: true })
      }
      const newCredits = PLAN_CREDITS[planKey]

      // Check current balance so we don't wipe credits on downgrade
      const { data: existing } = await supabase
        .from('user_credits')
        .select('balance, pack_credits')
        .eq('user_id', userId)
        .maybeSingle()

      const currentBalance = existing?.balance ?? 0
      // Always stack: new plan's allocation is added on top of existing balance,
      // whether it's an upgrade or a downgrade. Users never lose credits on plan change.
      const newBalance = currentBalance + newCredits

      await Promise.all([
        supabase.from('user_subscriptions').upsert({
          user_id: userId,
          plan: planKey,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dodo_subscription_id: (sub as any).subscription_id ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dodo_customer_id: (sub as any).customer_id ?? null,
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }),

        supabase.from('user_credits')
          .upsert({ user_id: userId, balance: newBalance, pack_credits: existing?.pack_credits ?? 0, plan: planKey, monthly_credits: newCredits }, { onConflict: 'user_id' }),
      ])

      console.log(`[dodo/webhook] activated ${planKey} for user ${userId} (balance: ${currentBalance} → ${newBalance} cr)`)
    }

    if (event.type === 'subscription.renewed') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id

      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase.from('user_subscriptions').select('user_id').eq('dodo_customer_id', subAny.customer_id).maybeSingle()
        userId = found?.user_id
      }

      const planKey = await resolvePlanKey(subAny, supabase, userId)
      if (!planKey) {
        console.warn(`[dodo/webhook] renewed: could not resolve plan for user ${userId}, skipping`)
        return NextResponse.json({ ok: true })
      }

      if (userId) {
        const credits = PLAN_CREDITS[planKey]
        const { data: existing } = await supabase
          .from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
        const packCredits = existing?.pack_credits ?? 0
        const currentBalance = existing?.balance ?? 0
        const monthlyReset = credits + packCredits
        const newBalance = Math.max(currentBalance, monthlyReset)
        await supabase.from('user_credits')
          .update({ balance: newBalance, pack_credits: packCredits, plan: planKey, monthly_credits: credits, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        console.log(`[dodo/webhook] renewed ${planKey} for user ${userId} (balance → ${newBalance})`)
      }
    }

    if (event.type === 'subscription.plan_changed') {
      // Treat exactly like subscription.active — new plan is now in effect
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id
      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('dodo_customer_id', subAny.customer_id)
          .maybeSingle()
        userId = found?.user_id
      }

      const planKey = await resolvePlanKey(subAny, supabase, userId)
      if (userId && planKey) {
        const newCredits = PLAN_CREDITS[planKey]
        const { data: existing } = await supabase
          .from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
        const currentBalance = existing?.balance ?? 0
        const newBalance = currentBalance + newCredits

        await Promise.all([
          supabase.from('user_subscriptions').upsert({
            user_id: userId, plan: planKey,
            dodo_subscription_id: subAny.subscription_id ?? null,
            dodo_customer_id: subAny.customer_id ?? null,
            status: 'active', updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' }),
          supabase.from('user_credits').upsert({
            user_id: userId, balance: newBalance,
            pack_credits: existing?.pack_credits ?? 0,
            plan: planKey, monthly_credits: newCredits,
          }, { onConflict: 'user_id' }),
        ])
        console.log(`[dodo/webhook] plan_changed → ${planKey} for user ${userId} (balance → ${newBalance})`)
      }
    }

    if (event.type === 'subscription.updated') {
      // Sync latest plan info without touching credit balance
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id
      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase.from('user_subscriptions').select('user_id').eq('dodo_customer_id', subAny.customer_id).maybeSingle()
        userId = found?.user_id
      }
      const planKey = await resolvePlanKey(subAny, supabase, userId)
      if (userId && planKey) {
        await supabase.from('user_subscriptions').upsert({
          user_id: userId, plan: planKey,
          dodo_subscription_id: subAny.subscription_id ?? null,
          dodo_customer_id: subAny.customer_id ?? null,
          status: subAny.status ?? 'active', updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        // Only update plan/monthly_credits in user_credits, not balance
        await supabase.from('user_credits').update({
          plan: planKey, monthly_credits: PLAN_CREDITS[planKey], updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        console.log(`[dodo/webhook] updated ${planKey} for user ${userId}`)
      }
    }

    if (event.type === 'subscription.cancelled') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id

      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase.from('user_subscriptions').select('user_id').eq('dodo_customer_id', subAny.customer_id).maybeSingle()
        userId = found?.user_id
      }

      if (userId) {
        await supabase.from('user_subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
      }
    }

    if (event.type === 'payment.succeeded') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payment = event.data as any
      const meta = payment.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id
      const planKeyFromMeta = meta?.plan_key

      // Resolve user via customer_id if metadata missing
      if (!userId && payment.customer_id) {
        const { data: found } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('dodo_customer_id', payment.customer_id)
          .maybeSingle()
        userId = found?.user_id
      }

      // Email fallback
      const payEmail = payment.customer?.email ?? payment.customer_email
      if (!userId && payEmail) {
        const { data: usersData } = await supabase.auth.admin.listUsers()
        const match = usersData?.users?.find(u => u.email?.toLowerCase() === payEmail.toLowerCase())
        userId = match?.id
        if (userId) console.log(`[dodo/webhook] payment: resolved user via email ${payEmail}`)
      }

      if (!userId) {
        console.warn(`[dodo/webhook] payment.succeeded: could not resolve user. meta=${JSON.stringify(meta)} customer_id=${payment.customer_id} email=${payEmail}`)
        return NextResponse.json({ ok: true })
      }

      // Determine which pack was purchased by matching product IDs in the cart
      const productIdToPackKey = getProductIdToPackKey()
      const cart: Array<{ product_id: string }> = payment.product_cart ?? []
      const cartPackKey = cart.map(item => productIdToPackKey[item.product_id]).find(Boolean)
      const packKey = (planKeyFromMeta && PACK_CREDITS[planKeyFromMeta]) ? planKeyFromMeta : cartPackKey

      if (packKey && PACK_CREDITS[packKey]) {
        const creditsToAdd = PACK_CREDITS[packKey]
        const { data: existing } = await supabase
          .from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
        const newPackCredits = (existing?.pack_credits ?? 0) + creditsToAdd
        const newBalance = (existing?.balance ?? 0) + creditsToAdd
        await supabase.from('user_credits')
          .update({ balance: newBalance, pack_credits: newPackCredits, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        console.log(`[dodo/webhook] pack ${packKey} (+${creditsToAdd}cr) for user ${userId}`)
        return NextResponse.json({ ok: true })
      }

      // Fallback: if planKey matches a subscription plan (e.g. Lite configured as one-time in Dodo)
      // treat this as a subscription activation — sync the plan and top up credits like subscription.active
      if (planKeyFromMeta && PLAN_CREDITS[planKeyFromMeta]) {
        const newCredits = PLAN_CREDITS[planKeyFromMeta]
        const { data: existing } = await supabase
          .from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
        const currentBalance = existing?.balance ?? 0
        const newBalance = currentBalance + newCredits
        await Promise.all([
          supabase.from('user_subscriptions').upsert({
            user_id: userId, plan: planKeyFromMeta,
            dodo_subscription_id: payment.subscription_id ?? null,
            dodo_customer_id: payment.customer_id ?? null,
            status: 'active', updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' }),
          supabase.from('user_credits').upsert({
            user_id: userId, balance: newBalance,
            pack_credits: existing?.pack_credits ?? 0,
            plan: planKeyFromMeta, monthly_credits: newCredits,
          }, { onConflict: 'user_id' }),
        ])
        console.log(`[dodo/webhook] payment→plan ${planKeyFromMeta} for user ${userId} (balance → ${newBalance})`)
        return NextResponse.json({ ok: true })
      }

      console.log(`[dodo/webhook] payment.succeeded: not a pack or known plan (planKey=${planKeyFromMeta}), ignoring`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[dodo/webhook] failed:', err)
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 400 })
  }
}
