'use client';

// src/components/wizard/steps/BuyersAgentStep.tsx
// Step 6: Buyer's Agent Information with dual representation option

import { Input } from '@/components/ui/input';
import { ManualTransactionData, EMPTY_AGENT_INFO } from '@/types/manual-wizard';
import { Building, Mail, Phone, User } from 'lucide-react';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

export default function BuyersAgentStep({ data, updateData }: Props) {
  const buyersAgent = data.buyersAgent || EMPTY_AGENT_INFO;
  const isDual = data.isDualRepresentation || false;

  const handleFieldChange = (
    field: keyof typeof EMPTY_AGENT_INFO,
    value: string
  ) => {
    updateData({
      buyersAgent: {
        ...buyersAgent,
        [field]: value,
      },
    });
  };

  const handleDualRepChange = (checked: boolean) => {
    if (checked && data.listingAgent) {
      // Auto-fill with listing agent info
      updateData({
        isDualRepresentation: true,
        buyersAgent: { ...data.listingAgent },
      });
    } else {
      // Clear the auto-fill
      updateData({
        isDualRepresentation: false,
        buyersAgent: EMPTY_AGENT_INFO,
      });
    }
  };

  const allFieldsFilled =
    buyersAgent.name &&
    buyersAgent.company &&
    buyersAgent.phone &&
    buyersAgent.email;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Enter the buyer's agent contact information.
        </p>
      </div>

      {/* Dual Representation Checkbox */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isDual}
            onChange={(e) => handleDualRepChange(e.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Same as listing agent (dual representation)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check this if the same agent represents both the buyer and seller
            </p>
          </div>
        </label>
      </div>

      {isDual && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Dual representation detected. The buyer's agent information has been
            auto-filled from the listing agent.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Agent Name */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Jane Smith"
              value={buyersAgent.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="pl-10"
              disabled={isDual}
            />
          </div>
        </div>

        {/* Company */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Company <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="XYZ Realty"
              value={buyersAgent.company}
              onChange={(e) => handleFieldChange('company', e.target.value)}
              className="pl-10"
              disabled={isDual}
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Phone <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="(555) 987-6543"
              value={buyersAgent.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              className="pl-10"
              disabled={isDual}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="agent@example.com"
              value={buyersAgent.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              className="pl-10"
              disabled={isDual}
            />
          </div>
        </div>
      </div>

      {allFieldsFilled && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800 font-medium">
            Buyer's agent information complete
          </p>
        </div>
      )}
    </div>
  );
}
