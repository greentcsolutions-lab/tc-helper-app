'use client';

import { Button } from '@/components/ui/button';
import { Zap, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function UpgradeButton({ size = 'default' }: { size?: 'default' | 'lg' | 'sm' }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/checkout', {
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
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size={size}
      className="gap-2"
      onClick={handleUpgrade}
      disabled={loading}
    >
      <Zap className="h-4 w-4" />
      {loading ? 'Loading...' : 'Upgrade to Basic'}
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
