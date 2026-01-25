'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight } from 'lucide-react';
import { UpgradeButton, UpgradeToStandardButton } from './BillingActions';

interface PlanComparisonProps {
  currentPlan: 'FREE' | 'BASIC' | 'STANDARD';
}

const PLANS = [
  {
    type: 'FREE',
    name: 'Free',
    price: 0,
    features: [
      '1 AI parse (lifetime)',
      '1 concurrent transaction',
      '10 custom tasks',
      '1 task template',
      'Basic support',
    ],
  },
  {
    type: 'BASIC',
    name: 'Basic',
    price: 15,
    priceAnnual: 150,
    popular: false,
    features: [
      '5 AI parses per month',
      '20 concurrent transactions',
      '100 custom tasks',
      '10 task templates',
      'Priority support',
      'Monthly resets',
    ],
  },
  {
    type: 'STANDARD',
    name: 'Standard',
    price: 50,
    priceAnnual: 500,
    popular: true,
    features: [
      '50 AI parses per month',
      '200 concurrent transactions',
      'Unlimited custom tasks',
      '50 task templates',
      'Priority support',
      'Monthly resets',
      'Advanced features (coming soon)',
    ],
  },
] as const;

export function PlanComparison({ currentPlan }: PlanComparisonProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Available Plans</h2>
        <p className="text-muted-foreground">
          {currentPlan === 'FREE'
            ? 'Upgrade to unlock more features and higher limits'
            : currentPlan === 'BASIC'
            ? 'Upgrade to Standard for even more capacity'
            : 'You have access to all features'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.type === currentPlan;
          const canUpgrade =
            (currentPlan === 'FREE' && (plan.type === 'BASIC' || plan.type === 'STANDARD')) ||
            (currentPlan === 'BASIC' && plan.type === 'STANDARD');

          return (
            <Card
              key={plan.type}
              className={`relative ${
                isCurrent
                  ? 'border-2 border-primary shadow-md'
                  : canUpgrade
                  ? 'border-2 border-muted hover:border-primary/50 transition-colors'
                  : 'opacity-60'
              }`}
            >
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Current Plan
                </Badge>
              )}
              {plan.popular && !isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="secondary">
                  Most Popular
                </Badge>
              )}

              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="space-y-1">
                  <div className="text-3xl font-bold">
                    ${plan.price}
                    {plan.price > 0 && <span className="text-base font-normal text-muted-foreground">/mo</span>}
                  </div>
                  {plan.priceAnnual && (
                    <p className="text-sm text-muted-foreground">
                      or ${plan.priceAnnual}/year (save ${plan.price * 12 - plan.priceAnnual})
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {canUpgrade && (
                  <div className="pt-4">
                    {plan.type === 'BASIC' ? (
                      <UpgradeButton size="default" />
                    ) : plan.type === 'STANDARD' ? (
                      <UpgradeToStandardButton size="default" />
                    ) : null}
                  </div>
                )}

                {isCurrent && plan.type !== 'FREE' && (
                  <div className="pt-4">
                    <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-1">
                      <Check className="h-4 w-4" />
                      You&apos;re on this plan
                    </p>
                  </div>
                )}

                {!isCurrent && !canUpgrade && plan.type !== 'FREE' && (
                  <div className="pt-4">
                    <p className="text-xs text-center text-muted-foreground">
                      Downgrade available through subscription management
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(currentPlan === 'BASIC' || currentPlan === 'STANDARD') && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <ArrowRight className="h-5 w-5 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Need to change or downgrade your plan?</h3>
                <p className="text-sm text-muted-foreground">
                  Use the &quot;Manage Subscription&quot; button below to change your plan or billing cycle.
                  Downgrades take effect at the end of your current billing period.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
