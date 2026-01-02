'use client';

// src/components/wizard/ManualTransactionWizard.tsx
// Main wizard component for manual transaction creation

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import {
  ManualTransactionData,
  WizardStep,
  WIZARD_STEPS,
  WIZARD_STEP_TITLES,
  EMPTY_AGENT_INFO,
  CA_DEFAULT_TIMELINE_DAYS,
} from '@/types/manual-wizard';

// Import wizard step components
import PropertyAddressStep from './steps/PropertyAddressStep';
import TransactionTypeStep from './steps/TransactionTypeStep';
import BuyerNamesStep from './steps/BuyerNamesStep';
import SellerNamesStep from './steps/SellerNamesStep';
import ListingAgentStep from './steps/ListingAgentStep';
import BuyersAgentStep from './steps/BuyersAgentStep';
import AcceptanceDateStep from './steps/AcceptanceDateStep';
import TimelineDatesStep from './steps/TimelineDatesStep';
import ReviewStep from './steps/ReviewStep';

interface Props {
  userState: string;
}

export default function ManualTransactionWizard({ userState }: Props) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = WIZARD_STEPS[currentStepIndex];

  // Initialize wizard data with CA defaults if user is in CA
  const [data, setData] = useState<Partial<ManualTransactionData>>({
    buyerNames: [''],
    sellerNames: [''],
    listingAgent: EMPTY_AGENT_INFO,
    buyersAgent: EMPTY_AGENT_INFO,
    isDualRepresentation: false,
    timeline:
      userState === 'CA'
        ? {
            acceptanceDate: '',
            ...CA_DEFAULT_TIMELINE_DAYS,
          }
        : {
            acceptanceDate: '',
            initialDepositDays: '',
            sellerDeliveryDays: '',
            inspectionDays: '',
            appraisalDays: '',
            loanDays: '',
            closingDays: '',
          },
  });

  const updateData = (updates: Partial<ManualTransactionData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'property-address':
        return !!data.propertyAddress && !!data.state;
      case 'transaction-type':
        return !!data.transactionType;
      case 'buyer-names':
        return (data.buyerNames?.filter((n) => n.trim()).length ?? 0) > 0;
      case 'seller-names':
        return (data.sellerNames?.filter((n) => n.trim()).length ?? 0) > 0;
      case 'listing-agent':
        return !!(
          data.listingAgent?.name &&
          data.listingAgent?.company &&
          data.listingAgent?.phone &&
          data.listingAgent?.email
        );
      case 'buyers-agent':
        return !!(
          data.buyersAgent?.name &&
          data.buyersAgent?.company &&
          data.buyersAgent?.phone &&
          data.buyersAgent?.email
        );
      case 'acceptance-date':
        return !!data.timeline?.acceptanceDate;
      case 'timeline-dates':
        return !!(
          data.timeline?.initialDepositDays &&
          data.timeline?.sellerDeliveryDays &&
          data.timeline?.closingDays
        );
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/transactions/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create transaction');
      }

      const result = await response.json();

      // Redirect to transactions page after successful creation
      router.push('/transactions');
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Failed to create transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'property-address':
        return <PropertyAddressStep data={data} updateData={updateData} />;
      case 'transaction-type':
        return <TransactionTypeStep data={data} updateData={updateData} />;
      case 'buyer-names':
        return <BuyerNamesStep data={data} updateData={updateData} />;
      case 'seller-names':
        return <SellerNamesStep data={data} updateData={updateData} />;
      case 'listing-agent':
        return <ListingAgentStep data={data} updateData={updateData} />;
      case 'buyers-agent':
        return <BuyersAgentStep data={data} updateData={updateData} />;
      case 'acceptance-date':
        return <AcceptanceDateStep data={data} updateData={updateData} />;
      case 'timeline-dates':
        return (
          <TimelineDatesStep
            data={data}
            updateData={updateData}
            userState={userState}
          />
        );
      case 'review':
        return <ReviewStep data={data} />;
      default:
        return <div>Unknown step</div>;
    }
  };

  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  const progressPercentage = (currentStepIndex / (WIZARD_STEPS.length - 1)) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Simple Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {currentStepIndex + 1} of {WIZARD_STEPS.length}
          </span>
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">
            {WIZARD_STEP_TITLES[currentStep]}
          </h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStep()}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStepIndex === 0 || isSubmitting}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Transaction'}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
