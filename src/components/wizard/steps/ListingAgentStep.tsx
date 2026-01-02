'use client';

// src/components/wizard/steps/ListingAgentStep.tsx
// Step 5: Listing Agent Information

import { Input } from '@/components/ui/input';
import { ManualTransactionData, EMPTY_AGENT_INFO } from '@/types/manual-wizard';
import { Building, Mail, Phone, User } from 'lucide-react';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

export default function ListingAgentStep({ data, updateData }: Props) {
  const listingAgent = data.listingAgent || EMPTY_AGENT_INFO;

  const handleFieldChange = (field: keyof typeof EMPTY_AGENT_INFO, value: string) => {
    updateData({
      listingAgent: {
        ...listingAgent,
        [field]: value,
      },
    });
  };

  const allFieldsFilled =
    listingAgent.name &&
    listingAgent.company &&
    listingAgent.phone &&
    listingAgent.email;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Enter the listing agent's contact information.
        </p>
      </div>

      <div className="space-y-4">
        {/* Agent Name */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="John Doe"
              value={listingAgent.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="pl-10"
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
              placeholder="ABC Realty"
              value={listingAgent.company}
              onChange={(e) => handleFieldChange('company', e.target.value)}
              className="pl-10"
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
              placeholder="(555) 123-4567"
              value={listingAgent.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              className="pl-10"
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
              value={listingAgent.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
