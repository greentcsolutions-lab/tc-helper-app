'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

// Define the onboarding fields we care about
const ONBOARDING_FIELDS = [
  'name',
  'phone',
  'role',
  'problems',
  'referralSource',
] as const;

type OnboardingField = typeof ONBOARDING_FIELDS[number];

interface MissingField {
  field: OnboardingField;
  label: string;
  type: 'text' | 'tel' | 'radio' | 'checkbox';
  options?: { value: string; label: string }[];
  optional?: boolean;
  placeholder?: string;
}

const FIELD_CONFIGS: Record<OnboardingField, MissingField> = {
  name: {
    field: 'name',
    label: "What's your name?",
    type: 'text',
    placeholder: 'John Doe',
  },
  phone: {
    field: 'phone',
    label: "What's your phone number?",
    type: 'tel',
    placeholder: '(555) 123-4567',
    optional: true,
  },
  role: {
    field: 'role',
    label: "What's your role?",
    type: 'radio',
    options: [
      { value: 'office_admin', label: 'Office Admin' },
      { value: 'solo_agent', label: 'Solo Agent' },
      { value: 'team_agent', label: 'Team Agent' },
      { value: 'team_leader', label: 'Team Leader' },
      { value: 'broker_ceo', label: 'Broker or CEO' },
      { value: 'other', label: 'Other' },
    ],
  },
  problems: {
    field: 'problems',
    label: 'What problems do you hope to solve?',
    type: 'checkbox',
    options: [
      { value: 'contract_extraction', label: 'Contract terms extraction' },
      { value: 'team_workflows', label: 'Team workflows' },
      { value: 'task_management', label: 'Task management' },
      { value: 'timeline_management', label: 'Timeline management' },
      { value: 'other', label: 'Other' },
    ],
  },
  referralSource: {
    field: 'referralSource',
    label: 'How did you hear about us?',
    type: 'radio',
    options: [
      { value: 'google', label: 'Google' },
      { value: 'x', label: 'X (Twitter)' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'referral', label: 'Referral' },
      { value: 'other', label: 'Other' },
    ],
  },
};

export default function ProgressiveOnboardingModal() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});
  const [showCelebration, setShowCelebration] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Check if we should show the modal
    checkAndShowModal();
  }, [isLoaded, isSignedIn, user]);

  const checkAndShowModal = async () => {
    try {
      // Fetch user data from our API to check for missing fields
      const response = await fetch('/api/progressive-onboarding/check');
      const data = await response.json();

      if (data.shouldShow && data.missingFields.length > 0) {
        // Map missing field names to their configs
        const missing = data.missingFields
          .filter((f: string) => ONBOARDING_FIELDS.includes(f as OnboardingField))
          .map((f: string) => FIELD_CONFIGS[f as OnboardingField]);

        setMissingFields(missing);
        setOpen(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const handleNotNow = async () => {
    setSaving(true);
    try {
      await fetch('/api/progressive-onboarding/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'not_now' }),
      });
      setOpen(false);
    } catch (error) {
      console.error('Error dismissing modal:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDontAskAgain = async () => {
    setSaving(true);
    try {
      await fetch('/api/progressive-onboarding/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'opt_out' }),
      });
      setOpen(false);
    } catch (error) {
      console.error('Error opting out:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const currentField = missingFields[currentFieldIndex];

    // Save current field
    await saveField(currentField.field);

    // Move to next or show celebration
    if (currentFieldIndex < missingFields.length - 1) {
      setCurrentFieldIndex((prev) => prev + 1);
    } else {
      // All done!
      setShowCelebration(true);
      setTimeout(() => {
        setOpen(false);
        setShowCelebration(false);
        setCurrentFieldIndex(0);
        setFieldValues({});
        setOtherValues({});
      }, 2000);
    }
  };

  const saveField = async (field: OnboardingField) => {
    setSaving(true);
    try {
      let value = fieldValues[field];

      // Handle "other" options
      if (field === 'role' && value === 'other') {
        value = otherValues[field] || '';
      } else if (field === 'problems' && Array.isArray(value) && value.includes('other')) {
        value = [...value.filter((v) => v !== 'other'), otherValues[field] || ''];
      } else if (field === 'referralSource' && value === 'other') {
        value = otherValues[field] || '';
      }

      await fetch('/api/progressive-onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      // Reload user to get updated metadata
      await user?.reload();
    } catch (error) {
      console.error('Error saving field:', error);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    const currentField = missingFields[currentFieldIndex];
    if (!currentField) return false;

    const value = fieldValues[currentField.field];

    if (currentField.optional && !value) return true;

    switch (currentField.type) {
      case 'text':
      case 'tel':
        return value && value.trim().length > 0;
      case 'radio':
        if (!value) return false;
        if (value === 'other') {
          return otherValues[currentField.field]?.trim().length > 0;
        }
        return true;
      case 'checkbox':
        if (!Array.isArray(value) || value.length === 0) return false;
        if (value.includes('other')) {
          return otherValues[currentField.field]?.trim().length > 0;
        }
        return true;
      default:
        return false;
    }
  };

  const toggleCheckbox = (field: OnboardingField, optionValue: string) => {
    const current = (fieldValues[field] as string[]) || [];
    const newValue = current.includes(optionValue)
      ? current.filter((v) => v !== optionValue)
      : [...current, optionValue];
    setFieldValues((prev) => ({ ...prev, [field]: newValue }));
  };

  const renderField = (config: MissingField) => {
    const { field, type, options, placeholder } = config;

    switch (type) {
      case 'text':
      case 'tel':
        return (
          <div className="space-y-2">
            <Label htmlFor={field}>{config.label}</Label>
            <Input
              id={field}
              type={type}
              value={fieldValues[field] || ''}
              onChange={(e) =>
                setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))
              }
              placeholder={placeholder}
              className="text-lg"
              autoFocus
            />
            {config.optional && (
              <p className="text-sm text-muted-foreground">
                Optional - but helps us provide better support
              </p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-4">
            <Label>{config.label}</Label>
            <RadioGroup
              value={fieldValues[field] || ''}
              onValueChange={(value) =>
                setFieldValues((prev) => ({ ...prev, [field]: value }))
              }
            >
              <div className="space-y-3">
                {options?.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-accent transition"
                  >
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label
                      htmlFor={option.value}
                      className="flex-1 cursor-pointer text-base"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            {fieldValues[field] === 'other' && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor={`${field}-other`}>Please specify</Label>
                <Input
                  id={`${field}-other`}
                  type="text"
                  value={otherValues[field] || ''}
                  onChange={(e) =>
                    setOtherValues((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  placeholder="Please specify"
                  className="text-lg"
                  autoFocus
                />
              </div>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-4">
            <Label>{config.label}</Label>
            <p className="text-sm text-muted-foreground">Select all that apply</p>
            <div className="space-y-3">
              {options?.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-accent transition"
                >
                  <Checkbox
                    id={option.value}
                    checked={
                      Array.isArray(fieldValues[field]) &&
                      fieldValues[field].includes(option.value)
                    }
                    onCheckedChange={() => toggleCheckbox(field, option.value)}
                  />
                  <Label
                    htmlFor={option.value}
                    className="flex-1 cursor-pointer text-base"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
            {Array.isArray(fieldValues[field]) &&
              fieldValues[field].includes('other') && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor={`${field}-other`}>Please specify</Label>
                  <Input
                    id={`${field}-other`}
                    type="text"
                    value={otherValues[field] || ''}
                    onChange={(e) =>
                      setOtherValues((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    placeholder="Other problems you want to solve"
                    className="text-lg"
                    autoFocus
                  />
                </div>
              )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  const currentField = missingFields[currentFieldIndex];
  const isLastField = currentFieldIndex === missingFields.length - 1;
  const hasAnsweredSome = currentFieldIndex > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleNotNow()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={handleNotNow}
        onEscapeKeyDown={handleNotNow}
      >
        {showCelebration ? (
          <div className="text-center space-y-6 py-12 animate-fade-in">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-bold text-foreground">All done!</h2>
            <p className="text-muted-foreground">Thanks for helping us serve you better!</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {hasAnsweredSome
                  ? 'Almost done...'
                  : "We're trying our darndest to make this the best tool possible, so if you could answer just a few more questions about yourself that would be awesome!"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4 animate-slide-in">
              {currentField && renderField(currentField)}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleNotNow}
                variant="outline"
                className="flex-1"
                disabled={saving}
              >
                Not now
              </Button>
              <Button
                onClick={handleDontAskAgain}
                variant="outline"
                className="flex-1"
                disabled={saving}
              >
                Don't ask again
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed() || saving}
                className="flex-1"
              >
                {saving ? 'Saving...' : isLastField ? 'Finish' : 'Next'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
