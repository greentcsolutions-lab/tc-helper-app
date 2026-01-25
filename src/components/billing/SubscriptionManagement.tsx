'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, AlertTriangle, Calendar, CreditCard, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionDetails {
  planType: string;
  planName: string;
  price: number;
  billingCycle: string | null;
  nextBillingDate: string | null;
  cancelAtPeriodEnd: boolean;
  manageUrl: string | null;
  status: string;
  valid?: boolean;
}

export function SubscriptionManagement() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);

  useEffect(() => {
    fetchSubscriptionDetails();
  }, []);

  const fetchSubscriptionDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/details');

      if (!response.ok) {
        throw new Error('Failed to fetch subscription details');
      }

      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = () => {
    if (subscription?.manageUrl) {
      window.location.href = subscription.manageUrl;
    } else {
      toast.error('Unable to access subscription management');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Details</CardTitle>
          <CardDescription>Loading your subscription information...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return null;
  }

  const isFree = subscription.planType === 'FREE';
  const nextBillingDate = subscription.nextBillingDate
    ? new Date(subscription.nextBillingDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Details</CardTitle>
        <CardDescription>
          {isFree ? 'You are currently on the free plan' : 'Manage your subscription'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{subscription.planName}</span>
              {subscription.cancelAtPeriodEnd && (
                <Badge variant="destructive">Cancels {nextBillingDate}</Badge>
              )}
              {subscription.status === 'active' && !isFree && (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
          </div>

          {!isFree && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Billing Cycle</span>
                <span className="font-medium capitalize">{subscription.billingCycle}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-medium">${subscription.price}</span>
              </div>

              {nextBillingDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {subscription.cancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
                  </span>
                  <span className="font-medium">{nextBillingDate}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Manage Subscription Button */}
        {!isFree && subscription.manageUrl && (
          <div className="space-y-3 pt-4 border-t">
            <Button
              onClick={handleManageSubscription}
              variant="default"
              className="w-full gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Manage Subscription
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Update payment method, change plan, view invoices, or cancel subscription
            </p>

            {/* Cancellation Dialog */}
            {!subscription.cancelAtPeriodEnd && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Cancel Subscription?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3 pt-2">
                      <p>
                        Your subscription will remain active until{' '}
                        <strong>{nextBillingDate}</strong>. After that, your plan will automatically
                        downgrade to Free.
                      </p>
                      <p className="text-sm">
                        <strong>What happens to my data?</strong>
                      </p>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li>All existing data will remain safe and accessible</li>
                        <li>
                          If you exceed Free plan limits, you may need to archive transactions
                          before creating new ones
                        </li>
                        <li>You can reactivate your subscription anytime</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction onClick={handleManageSubscription} className="bg-destructive hover:bg-destructive/90">
                      Continue to Cancel
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
