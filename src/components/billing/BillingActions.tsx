'use client';

import { Button } from '@/components/ui/button';
import { Zap, CreditCard, Settings, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface UpgradeButtonProps {
  size?: 'default' | 'lg' | 'sm';
  plan?: 'basic' | 'standard';
}

export function UpgradeButton({ size = 'default', plan = 'basic' }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to create checkout session');
        return;
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const label = plan === 'standard' ? 'Upgrade to Standard' : 'Upgrade to Basic';

  return (
    <Button
      size={size}
      className="gap-2"
      onClick={handleUpgrade}
      disabled={loading}
    >
      <Zap className="h-4 w-4" />
      {loading ? 'Loading...' : label}
    </Button>
  );
}

export function BuyCreditsButton({ variant = 'outline' }: { variant?: 'default' | 'outline' }) {
  const [loading, setLoading] = useState(false);

  const handleBuyCredits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/buy-credits', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to create checkout session');
        return;
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Credit checkout error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      className="gap-2"
      onClick={handleBuyCredits}
      disabled={loading}
    >
      <CreditCard className="h-4 w-4" />
      {loading ? 'Loading...' : 'Buy Credits'}
    </Button>
  );
}

interface ManageSubscriptionButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'lg' | 'sm';
  className?: string;
}

export function ManageSubscriptionButton({
  variant = 'outline',
  size = 'default',
  className = '',
}: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/portal');

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to open billing portal');
        return;
      }

      const { url } = await response.json();

      // Open in new tab for smoother UX - user can return to app easily
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Portal error:', error);
      toast.error('Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`gap-2 ${className}`}
      onClick={handleManageSubscription}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening...
        </>
      ) : (
        <>
          <Settings className="h-4 w-4" />
          Manage Subscription
          <ExternalLink className="h-3 w-3 opacity-50" />
        </>
      )}
    </Button>
  );
}
