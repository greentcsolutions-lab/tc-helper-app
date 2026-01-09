'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
] as const;

type State = typeof usStates[number];

const roleOptions = [
  { value: "office_admin", label: "Office Admin" },
  { value: "solo_agent", label: "Solo Agent" },
  { value: "team_agent", label: "Team Agent" },
  { value: "team_leader", label: "Team Leader" },
  { value: "broker_ceo", label: "Broker or CEO" },
  { value: "other", label: "Other" },
];

const problemOptions = [
  { value: "contract_extraction", label: "Contract terms extraction" },
  { value: "team_workflows", label: "Team workflows" },
  { value: "task_management", label: "Task management" },
  { value: "timeline_management", label: "Timeline management" },
  { value: "other", label: "Other" },
];

const referralOptions = [
  { value: "google", label: "Google" },
  { value: "x", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

export default function OnboardingPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  // Form state
  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<State | null>(null);
  const [role, setRole] = useState('');
  const [roleOther, setRoleOther] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [problemsOther, setProblemsOther] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralOther, setReferralOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPhoneWarning, setShowPhoneWarning] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Calculate total steps based on whether user needs to enter name/email
  const [totalSteps, setTotalSteps] = useState(7); // Default: all steps

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Pre-fill from Google OAuth if available
      const clerkName = user?.fullName || user?.firstName || '';
      const clerkEmail = user?.emailAddresses[0]?.emailAddress || '';

      setName(clerkName);
      setEmail(clerkEmail);

      // Skip name/email steps if we have them from OAuth
      let skipSteps = 0;
      if (clerkName) skipSteps++;
      if (clerkEmail) skipSteps++;

      // Total steps: name, email, phone, state, role, problems, referral
      setTotalSteps(7 - skipSteps);

      // Redirect if already onboarded
      if (user?.publicMetadata?.onboarded as boolean) {
        router.replace('/dashboard');
      }
    }
  }, [isLoaded, isSignedIn, user, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleNext = () => {
    // Skip name step if pre-filled
    if (currentStep === 0 && name && user?.fullName) {
      setCurrentStep(1);
      return;
    }

    // Skip email step if pre-filled
    if (currentStep === 1 && email && user?.emailAddresses[0]?.emailAddress) {
      setCurrentStep(2);
      return;
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleSkipPhone = () => {
    setShowPhoneWarning(true);
    setTimeout(() => {
      setShowPhoneWarning(false);
      handleNext();
    }, 2000);
  };

  const toggleProblem = (value: string) => {
    setProblems((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      // Build final role value
      const finalRole = role === 'other' ? roleOther : role;

      // Build final problems array
      const finalProblems = problems.includes('other')
        ? [...problems.filter((p) => p !== 'other'), problemsOther]
        : problems;

      // Build final referral source
      const finalReferral = referralSource === 'other' ? referralOther : referralSource;

      const res = await fetch('/api/save-user-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          state,
          role: finalRole,
          problems: finalProblems,
          referralSource: finalReferral,
          onboarded: true,
        }),
      });

      if (res.ok) {
        await user?.reload();
        setShowCelebration(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      } else {
        const errorData = await res.json();
        console.error('Save failed:', errorData);
        alert(`Failed to save: ${errorData.error || 'Please try again.'}`);
        setSaving(false);
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      alert('Network error. Please check your connection.');
      setSaving(false);
    }
  };

  const canProceed = () => {
    const actualStep = getActualStep();

    switch (actualStep) {
      case 'name': return name.trim().length > 0;
      case 'email': return email.includes('@');
      case 'phone': return true; // Phone is optional
      case 'state': return state !== null;
      case 'role': return role && (role !== 'other' || roleOther.trim().length > 0);
      case 'problems': return problems.length > 0 && (!problems.includes('other') || problemsOther.trim().length > 0);
      case 'referral': return referralSource && (referralSource !== 'other' || referralOther.trim().length > 0);
      default: return false;
    }
  };

  // Map currentStep to actual step name (accounting for skipped steps)
  const getActualStep = () => {
    let step = currentStep;
    const hasName = user?.fullName || name;
    const hasEmail = user?.emailAddresses[0]?.emailAddress || email;

    // Adjust for skipped steps
    if (hasName && step >= 0) step++;
    if (hasEmail && step >= 1) step++;

    const steps = ['name', 'email', 'phone', 'state', 'role', 'problems', 'referral'];
    return steps[step] || 'done';
  };

  const renderStep = () => {
    const actualStep = getActualStep();

    // Show celebration screen
    if (showCelebration || actualStep === 'done') {
      return (
        <div className="text-center space-y-6 animate-fade-in">
          <div className="text-6xl animate-bounce">🎉</div>
          <h2 className="text-2xl font-bold text-foreground">Welcome to TC Helper!</h2>
          <p className="text-muted-foreground">Getting your workspace ready...</p>
          <div className="flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      );
    }

    switch (actualStep) {
      case 'name':
        return (
          <div className="space-y-4 animate-slide-in">
            <h2 className="text-2xl font-bold text-foreground">What's your name?</h2>
            <p className="text-muted-foreground">Let's get to know you better</p>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="text-lg"
                autoFocus
              />
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4 animate-slide-in">
            <h2 className="text-2xl font-bold text-foreground">What's your email?</h2>
            <p className="text-muted-foreground">We'll use this to keep you updated</p>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="text-lg"
                autoFocus
              />
            </div>
          </div>
        );

      case 'phone':
        return (
          <div className="space-y-4 animate-slide-in">
            <h2 className="text-2xl font-bold text-foreground">What's your phone number?</h2>
            <p className="text-muted-foreground">Optional, but helps us provide better support</p>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="text-lg"
                autoFocus
              />
            </div>
            {showPhoneWarning && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 animate-fade-in">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Without a phone number, you may not be able to access certain features like SMS notifications.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleNext} className="flex-1" disabled={!phone}>
                Continue
              </Button>
              <Button onClick={handleSkipPhone} variant="outline" className="flex-1">
                Skip
              </Button>
            </div>
          </div>
        );

      case 'state':
        return (
          <div className="space-y-4 animate-slide-in">
            <h2 className="text-2xl font-bold text-foreground">What state do you work in?</h2>
            <p className="text-muted-foreground">This helps us provide state-specific features</p>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <select
                id="state"
                value={state ?? ""}
                onChange={(e) => setState((e.target.value as State) || null)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition text-lg"
                autoFocus
              >
                <option value="">Select your state</option>
                {usStates.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'role':
        return (
          <div className="space-y-4 animate-slide-in">
            <h2 className="text-2xl font-bold text-foreground">What's your role?</h2>
            <p className="text-muted-foreground">Help us understand how you work</p>
            <RadioGroup value={role} onValueChange={setRole}>
              <div className="space-y-3">
                {roleOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-accent transition">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer text-base">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            {role === 'other' && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="roleOther">Please specify</Label>
                <Input
                  id="roleOther"
                  type="text"
                  value={roleOther}
                  onChange={(e) => setRoleOther(e.target.value)}
                  placeholder="Your role"
                  className="text-lg"
                  autoFocus
                />
              </div>
            )}
          </div>
        );

      case 'problems':
        return (
          <div className="space-y-4 animate-slide-in">
            <h2 className="text-2xl font-bold text-foreground">What problems do you hope to solve?</h2>
            <p className="text-muted-foreground">Select all that apply</p>
            <div className="space-y-3">
              {problemOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-accent transition">
                  <Checkbox
                    id={option.value}
                    checked={problems.includes(option.value)}
                    onCheckedChange={() => toggleProblem(option.value)}
                  />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer text-base">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
            {problems.includes('other') && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="problemsOther">Please specify</Label>
                <Input
                  id="problemsOther"
                  type="text"
                  value={problemsOther}
                  onChange={(e) => setProblemsOther(e.target.value)}
                  placeholder="Other problems you want to solve"
                  className="text-lg"
                  autoFocus
                />
              </div>
            )}
          </div>
        );

      case 'referral':
        return (
          <div className="space-y-4 animate-slide-in">
            <h2 className="text-2xl font-bold text-foreground">How did you hear about us?</h2>
            <p className="text-muted-foreground">Help us understand how you found TC Helper</p>
            <RadioGroup value={referralSource} onValueChange={setReferralSource}>
              <div className="space-y-3">
                {referralOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-accent transition">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer text-base">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            {referralSource === 'other' && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="referralOther">Please specify</Label>
                <Input
                  id="referralOther"
                  type="text"
                  value={referralOther}
                  onChange={(e) => setReferralOther(e.target.value)}
                  placeholder="How did you find us?"
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

  const actualStep = getActualStep();
  const isPhoneStep = actualStep === 'phone';
  const isFinalStep = actualStep === 'referral';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">TC Helper</h1>
            <p className="text-muted-foreground mt-1">Real estate transaction management made simple</p>
          </div>
          <UserButton />
        </div>

        {/* Progress bar */}
        {!showCelebration && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Step {currentStep + 1} of {totalSteps}</span>
              <span className="text-sm text-muted-foreground">{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl border border-border p-8 sm:p-12 min-h-[400px] flex flex-col">
          <div className="flex-1">
            {renderStep()}
          </div>

          {/* Navigation buttons */}
          {!showCelebration && !isPhoneStep && (
            <div className="flex gap-4 mt-8">
              {currentStep > 0 && (
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Back
                </Button>
              )}
              {!isFinalStep ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || saving}
                  className="flex-1"
                >
                  {saving ? "Saving..." : "Complete Setup"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
