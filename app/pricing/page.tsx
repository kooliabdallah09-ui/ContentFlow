'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: 0,
      credits: 50,
      description: 'Perfect for getting started',
      features: [
        'Blog post generation',
        'Social media posts',
        'Email sequences',
        '50 credits/month',
        'Basic analytics',
        'Community support'
      ],
      cta: 'Get Started',
      highlighted: false
    },
    {
      name: 'Starter',
      price: 19,
      credits: 1000,
      description: 'For emerging creators',
      features: [
        'All Free features',
        'Priority generation',
        'UGC video generation',
        '1,000 credits/month',
        'Advanced analytics',
        'Email support',
        'Custom branding'
      ],
      cta: 'Start Free Trial',
      highlighted: false
    },
    {
      name: 'Pro',
      price: 49,
      credits: 4000,
      description: 'For serious creators',
      features: [
        'All Starter features',
        'Unlimited generations',
        'API access',
        '4,000 credits/month',
        'Real-time analytics',
        'Priority support',
        'Custom integrations',
        'Team collaboration'
      ],
      cta: 'Start Free Trial',
      highlighted: true
    },
    {
      name: 'Agency',
      price: 149,
      credits: 15000,
      description: 'For agencies & enterprises',
      features: [
        'All Pro features',
        'Dedicated account manager',
        'Custom workflows',
        '15,000 credits/month',
        'Advanced API features',
        '24/7 phone support',
        'SLA guarantee',
        'White-label options'
      ],
      cta: 'Contact Sales',
      highlighted: false
    }
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
          border: 2px solid rgba(255, 255, 255, 0.3);
          transform: scale(1.05);
        }

        .pricing-card.featured:hover {
          transform: scale(1.05) translateY(-4px);
          border-color: rgba(255, 255, 255, 0.5);
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
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <h1 className="text-5xl font-black mb-4">Simple, Transparent Pricing</h1>
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
                  <span className="bg-white text-black px-4 py-1 rounded-full text-xs font-black">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
              <p className="text-white/60 text-sm mb-6">{plan.description}</p>

              <div className="mb-8">
                <div className="text-4xl font-black mb-1">
                  €{plan.price}
                  <span className="text-lg text-white/60 font-600">/month</span>
                </div>
                <div className="text-white/60 text-sm">
                  {plan.credits.toLocaleString()} credits included
                </div>
              </div>

              <button className={plan.name === 'Pro' || plan.name === 'Agency' ? 'btn-secondary' : 'btn-primary'}>
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
