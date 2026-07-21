# BytePlus Direct — Seedance 2.0 Rate Card

Source: BytePlus ModelArk pricing page, confirmed 2026-07-21.
This is what our COGS would be if we migrate CineMotion / UGC video off Replicate onto BytePlus direct.

## Raw unit prices (USD per 1M tokens)

| Model ID | 480p / 720p | 1080p | 4K |
|---|---|---|---|
| `dreamina-seedance-2-0-260128` (base) — text→video | $7.00 | $7.70 | $4.00 |
| `dreamina-seedance-2-0-260128` (base) — image→video | $4.30 | $4.70 | $2.40 |
| `dreamina-seedance-2-0-fast-260128` — text→video | $5.60 | — (unsupported) | — |
| `dreamina-seedance-2-0-fast-260128` — image→video | $3.30 | — (unsupported) | — |
| `dreamina-seedance-2-0-mini-260615` — text→video | $3.50 | — (unsupported) | — |
| `dreamina-seedance-2-0-mini-260615` — image→video | $2.10 | — (unsupported) | — |

Note: 4K per-token rate is *lower* than 1080p because token count scales with resolution — the total clip cost is still highest at 4K.

## Token formula

```
tokens = (input_video_duration_s + output_video_duration_s) × output_width × output_height × output_fps / 1024
price  = unit_price / 1_000_000 × tokens
```

At 24 fps, 16:9 output:

| Resolution | Pixels | Tokens per output second |
|---|---|---|
| 480p | 854 × 480 | ~9,606 |
| 720p | 1280 × 720 | 21,600 |
| 1080p | 1920 × 1080 | 48,600 |
| 4K | 3840 × 2160 | 194,400 |

## Real per-clip cost (image→video, 8s @ 24 fps, 16:9) — the CineMotion path

| Model / resolution | Tokens | Cost |
|---|---|---|
| Base 480p | 76,848 | **$0.33** |
| Base 720p | 172,800 | **$0.74** |
| Base 1080p | 388,800 | **$1.83** |
| Base 4K | 1,555,200 | **$3.73** |
| Fast 480p | 76,848 | $0.25 |
| Fast 720p | 172,800 | $0.57 |
| Mini 480p | 76,848 | $0.16 |
| Mini 720p | 172,800 | $0.36 |

## Vs Replicate (image→video / `video_in` rate card)

| Resolution | Replicate 8s | BytePlus 8s | Savings |
|---|---|---|---|
| 720p | ~$1.44 | $0.74 | 49% |
| 1080p | $4.40 | $1.83 | 58% |
| 4K | $10.00 | $3.73 | **63%** |

This is why Higgsfield can advertise "4K Seedance for ~$4" — they're just eating the direct BytePlus rate. Same math is available to us.

## What still needs verifying before we migrate

- Fast / Mini 4K support — the pricing page says "1080p not supported," 4K is unclear. Assume unsupported until we test.
- BytePlus rate limits on the personal account (starter tier is ~5–10 concurrent jobs). CineMotion is bursty; may need business KYB later.
- 5 s minimum billable duration (matches "Counted Total Video Duration" note in the console — sub-5s clips still charge for 5s).
- Content moderation: BytePlus is stricter than Replicate on some categories. Test our common UGC prompts before cutting over.
