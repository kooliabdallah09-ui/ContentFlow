'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: 0,
      credits: 60,
      currency: '$',
      description: 'One-time signup credit — try it before committing',
      features: [
        '60 credits at signup (no monthly refill)',
        '~1 Standard 4s UGC video + 3 product images',
        '"Made with ContentFlow" watermark',
        'All generators unlocked',
        'Community support',
      ],
      cta: 'Get Started',
      highlighted: false
    },
    {
      name: 'Starter',
      price: 19,
      credits: 800,
      currency: '$',
      description: 'For creators posting weekly',
      features: [
        '800 credits/month',
        '~9 Standard 8s OR 7 Hero 8s UGC videos',
        'No watermark',
        'Unlimited text & image generations (within caps)',
        '30-day history',
        'Email support',
      ],
      cta: 'Start Free Trial',
      highlighted: false
    },
    {
      name: 'Pro',
      price: 49,
      credits: 2000,
      currency: '$',
      description: 'For brands posting daily',
      features: [
        '2,000 credits/month',
        '~23 Standard 8s OR 19 Hero 8s UGC videos',
        'Long-form durations (20s, 30s, chained)',
        'Content calendar & scheduling',
        'Priority generation queue',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      highlighted: true
    },
    {
      name: 'Agency',
      price: 149,
      credits: 6500,
      currency: '$',
      description: 'For agencies running multi-client UGC',
      features: [
        '6,500 credits/month',
        '~77 Standard 8s OR 62 Hero 8s UGC videos',
        'Multi-client workspaces',
        'Bulk variant generation',
        'Dedicated account manager',
        'Priority & phone support',
      ],
      cta: 'Contact Sales',
      highlighted: false
    }
  ]

  const creditPacks = [
    { id: 'small',  credits: 500,   price: 15,  perCredit: 0.030, bonus: null },
    { id: 'medium', credits: 1500,  price: 40,  perCredit: 0.027, bonus: '+11%' },
    { id: 'large',  credits: 5000,  price: 120, perCredit: 0.024, bonus: '+20%' },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-4px);
        }

        .pricing-card {
          position: relative;
          transition: all 0.3s ease;
        }

        .pricing-card.featured {
          border: 2px solid #06B6D4;
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(6, 182, 212, 0.2);
        }

        .pricing-card.featured:hover {
          transform: scale(1.05) translateY(-4px);
          border-color: #06B6D4;
          box-shadow: 0 0 40px rgba(6, 182, 212, 0.4);
        }

        .btn-primary {
          background: #ffffff;
          color: #000000;
          transition: all 0.3s ease;
          font-weight: 600;
          border: 1px solid #ffffff;
          width: 100%;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #f0f0f0;
          transform: translateY(-2px);
        }

        .btn-secondary {
          background: transparent;
          color: #ffffff;
          transition: all 0.3s ease;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.2);
          width: 100%;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.4);
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-green-400/30 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <h1 className="text-5xl font-black mb-4">Simple, <span className="text-cyan-400">Transparent</span> Pricing</h1>
          <p className="text-white/60 text-lg max-w-2xl">
            Choose the perfect plan for your content creation needs. All plans include access to all generators.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card pricing-card rounded-2xl p-8 flex flex-col ${
                plan.highlighted ? 'featured' : ''
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-400 text-black px-4 py-1 rounded-full text-xs font-black shadow-lg shadow-green-400/50">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
              <p className="text-white/60 text-sm mb-6">{plan.description}</p>

              <div className="mb-8">
                <div className="text-4xl font-black mb-1">
                  <span className={plan.highlighted ? 'text-cyan-400' : 'text-white'}>{plan.currency}{plan.price}</span>
                  <span className="text-lg text-white/60 font-600">/month</span>
                </div>
                <div className={plan.highlighted ? 'text-cyan-400/70 text-sm' : 'text-white/60 text-sm'}>
                  {plan.credits.toLocaleString()} credits included
                </div>
              </div>

              <button className={`w-full py-3 rounded-lg font-600 text-sm ${
                plan.highlighted
                  ? 'bg-green-400 text-black hover:bg-green-300 hover:shadow-lg hover:shadow-green-400/50'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}>
                {plan.cta}
              </button>

              <div className="mt-8 pt-8 border-t border-white/10">
                <h4 className="text-sm font-black text-white/80 mb-4">What's included:</h4>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Pay-as-you-go credit packs */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-3">Need extra credits?</h2>
            <p className="text-white/60">One-time credit packs — no subscription. Top up any plan anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {creditPacks.map((pack) => (
              <div key={pack.id} className="glass-card rounded-2xl p-8 flex flex-col">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-2xl font-black">{pack.credits.toLocaleString()} cr</h3>
                  {pack.bonus && (
                    <span className="bg-cyan-400/20 text-cyan-300 px-2 py-1 rounded text-xs font-black">
                      {pack.bonus} value
                    </span>
                  )}
                </div>
                <div className="text-4xl font-black mb-1">${pack.price}</div>
                <p className="text-white/60 text-sm mb-6">${pack.perCredit.toFixed(3)} per credit</p>
                <button className="btn-secondary mt-auto">Buy credits</button>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-black mb-12 text-center">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-black mb-2">How do credits work?</h3>
              <p className="text-white/70">
                Credits are used for generating content. Each type of generation uses a different amount of credits based on complexity and API costs. You can see credit usage before generating.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-black mb-2">Do unused credits roll over?</h3>
              <p className="text-white/70">
                Credits are reset monthly on your billing date. Unused credits do not roll over to the next month.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-black mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-white/70">
                Yes, you can change your plan at any time. Changes take effect immediately, and we'll adjust your billing accordingly.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-black mb-2">What payment methods do you accept?</h3>
              <p className="text-white/70">
                We accept all major credit cards (Visa, Mastercard, American Express) through secure Stripe payments.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-black mb-2">Is there a free trial?</h3>
              <p className="text-white/70">
                Yes, the Free plan is always available. Paid plans include a 7-day free trial so you can test premium features risk-free.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-black mb-2">How is pricing calculated for teams?</h3>
              <p className="text-white/70">
                Team collaboration is included in all paid plans. You can invite unlimited team members at no additional cost.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 glass-card rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-black mb-4">Ready to start creating?</h2>
          <p className="text-white/60 mb-8 max-w-2xl mx-auto">
            Join thousands of creators using ContentFlow to generate high-quality content at scale.
          </p>
          <Link href="/dashboard" className="inline-block">
            <button className="btn-primary px-8 py-3 rounded-lg font-600">
              Get Started for Free
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
