# ContentFlow Business Sheet

Last updated: 2026-09-07

## 1. Fixed Monthly Costs (baseline)

| Item | Cost | Notes |
|---|---|---|
| Vercel Pro | $20/mo | Required — hit Function Storage cap on free |
| Supabase Pro | $25/mo | Required — free tier auto-pauses |
| Domain (contentflow-web.com) | ~$1.25/mo | ~$15/yr |
| ElevenLabs Creator (optional) | $22/mo | Add when voiceover volume exceeds free tier |
| **Baseline** | **~$46/mo** | Without ElevenLabs sub |
| **With ElevenLabs** | **~$68/mo** | Add when needed |

**No fixed cost for**: Dodo Payments (transaction-only), OpenAI/Anthropic/BytePlus (usage-only).

---

## 2. Variable Costs — Per Generation

Raw vendor cost (before markup). Source: `lib/ugc-pricing.ts`.

| Generation | Raw cost | Retail credits | Retail $ | Gross margin |
|---|---|---|---|---|
| UGC 5s @ 480p (Mini) | ~$0.18 | ~15 cr | $0.38 | +$0.20 |
| UGC 5s @ 720p (Seedance 2.0) | ~$0.84 | ~45 cr | $1.13 | +$0.29 |
| UGC 10s @ 720p (2.0) | ~$1.60 | ~90 cr | $2.25 | +$0.65 |
| UGC 10s @ 1080p (2.0) | ~$3.83 | ~210 cr | $5.25 | +$1.42 |
| UGC 10s @ 720p (2.5 premium) | ~$2.40 | ~130 cr | $3.25 | +$0.85 |
| Image NB Pro | $0.075 | 5 cr | $0.13 | +$0.05 |
| Image NB2 | $0.039 | 3 cr | $0.08 | +$0.04 |
| Voiceover per 100 chars | $0.03 | 5 cr | $0.13 | +$0.10 |
| Preview (`/try`, loss leader) | ~$0.18 | 0 | $0 | **-$0.18** |

**1.4× markup → ~28% gross margin per generation before fixed costs.**

---

## 3. Revenue Per Plan (net of Dodo fee ~3.5%)

| Plan | Price | Credits | Net revenue | Vendor cost (70% burn) | **Gross profit/user/mo** |
|---|---|---|---|---|---|
| Free | $0 | 30 signup | $0 | -$0.38 | **-$0.38** |
| Lite | $8 | 300/mo | $7.42 | $3.75 | **+$3.67 (49%)** |
| Starter | $19 | 800/mo | $18.34 | $10.00 | **+$8.34 (45%)** |
| Pro | $49 | 2,000/mo | $47.28 | $25.00 | **+$22.28 (47%)** |
| Agency | $149 | 6,500/mo | $144.38 | $81.25 | **+$63.13 (44%)** |
| Enterprise | $605 | 25,000/mo | $587.15 | $312.50 | **+$274.65 (47%)** |

Credit packs (add-ons) have better margin (~55%) because they're bursty.

---

## 4. Two Loss Leaders

| | Cost | Purpose |
|---|---|---|
| Free signup (30 credits) | ~$0.50 avg | Onboard demo |
| `/try` preview | ~$0.18 per preview | Convert cold traffic |

These are marketing costs, not gross-margin killers.

---

## 5. Unit Economics — Per Paying User

Blended assuming plan mix: 60% Lite, 30% Starter, 10% Pro.

| Metric | Value |
|---|---|
| ARPU | $15.40/mo |
| Net revenue after Dodo fees | $14.40/mo |
| Vendor cost (70% burn) | $7.75/mo |
| **Gross profit per paying user** | **$6.65/mo** |
| Monthly churn (assumed) | 8-10% |
| **LTV (12-mo avg life)** | **~$80** |
| Marketing cost per paid user acquired | ~$6 |
| **LTV : CAC ratio** | **~13:1** ✅ |
| **Payback period** | **~1 month** |

---

## 6. Break-Even

- **Fixed-cost break-even**: 7 paying users (~$60 MRR)
- **All-in break-even**: ~15-20 paying users (~$150 MRR)
- Positive cash-flow by month 2-3 in most scenarios

---

## 7. Three Scenarios

Assumptions: 20% visitor→signup, 8% signup→paid, 10% monthly churn.

### 🐢 Slow (50 visitors/day)
| Month | Total paid | Revenue | Cost | P&L |
|---|---|---|---|---|
| M1 | 24 | $160 | $217 | -$57 |
| M6 | 112 | $745 | $217 | +$528 |
| M12 | 200 | $1,330 | $217 | +$1,113 |
| M24 (steady) | 240 | $1,596 | $217 | **+$1,379/mo** |

### 🚶 Moderate (200 visitors/day)
| Month | Total paid | Revenue | Cost | P&L |
|---|---|---|---|---|
| M1 | 96 | $638 | $730 | -$92 |
| M6 | 451 | $3,000 | $730 | +$2,270 |
| M12 | 810 | $5,387 | $730 | +$4,657 |
| M24 (steady) | 960 | $6,384 | $730 | **+$5,654/mo** |

### 🚀 Successful (1000 visitors/day)
| Month | Total paid | Revenue | Cost | P&L |
|---|---|---|---|---|
| M1 | 480 | $3,192 | $3,570 | -$378 |
| M6 | 2,256 | $15,002 | $3,570 | +$11,432 |
| M12 | 4,043 | $26,886 | $3,570 | +$23,316 |
| M24 (steady) | 4,800 | $31,920 | $3,570 | **+$28,350/mo (~$340k/yr)** |

---

## 8. KPIs to Watch (weekly)

| Metric | Target | Alarm if |
|---|---|---|
| Visitor → `/try` preview | >25% | <15% (hero weak) |
| Preview → signup | >20% | <10% (upsell weak) |
| Signup → paid (14 days) | >5% | <3% (free too generous or paywall too hard) |
| Monthly churn | <10% | >15% (product not sticky) |
| ARPU | >$14 | <$10 (all on Lite) |
| Credit utilization/plan | 60-80% | >95% (offer packs) |
| Vendor cost / revenue | <55% | >60% (underpriced) |

---

## 9. Warnings

1. **`/try` abuse**: in-memory rate limit is fragile. Move to Vercel KV if abuse appears.
2. **Storage bleed**: every generation stores forever. Add 90-day auto-cleanup on `preview-output/` and `hero-frames/`.
3. **Verify Dodo fee rate** for international cards (may be 4-4.5%).
4. **Free tier gaming**: add signup anti-abuse (email verify + IP dedup or bonus after first Brand Kit save).
5. **Chargebacks**: budget 1-2% for reversed dropshipper transactions.
6. **Scaling infra**: at 1000 visitors/day expect $150-300/mo fixed.

---

## 10. Bottom Line

- Break-even: ~15-20 paying users
- Payback per user: ~1 month
- 12-month realistic (moderate): ~$4-5k/mo profit
- 24-month upside: $60-100k/yr profit
