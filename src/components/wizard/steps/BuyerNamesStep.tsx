'use client';

// src/components/wizard/steps/BuyerNamesStep.tsx
// Step 3: Buyer Names (multi-entry, up to 4)

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ManualTransactionData } from '@/types/manual-wizard';
import { Plus, X } from 'lucide-react';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

export default function BuyerNamesStep({ data, updateData }: Props) {
  const buyerNames = data.buyerNames || [''];
  const MAX_BUYERS = 4;

  const handleNameChange = (index: number, value: string) => {
    const updated = [...buyerNames];
    updated[index] = value;
    updateData({ buyerNames: updated });
  };

  const addBuyer = () => {
    if (buyerNames.length < MAX_BUYERS) {
      updateData({ buyerNames: [...buyerNames, ''] });
    }
  };

  const removeBuyer = (index: number) => {
    if (buyerNames.length > 1) {
      const updated = buyerNames.filter((_, i) => i !== index);
      updateData({ buyerNames: updated });
    }
  };

  const filledBuyers = buyerNames.filter((name) => name.trim()).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Enter the buyer name(s) for this transaction. You can add up to 4
          buyers.
        </p>
      </div>

      <div className="space-y-4">
        {buyerNames.map((name, index) => (
          <div key={index} className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Buyer {index + 1} {index === 0 && '(Required)'}
              </label>
              <Input
                placeholder="Full Name"
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
              />
            </div>
            {buyerNames.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeBuyer(index)}
                className="mt-6"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {buyerNames.length < MAX_BUYERS && (
        <Button
          variant="outline"
          onClick={addBuyer}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Buyer
        </Button>
      )}

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Tip:</span> Enter full legal names as
          they appear on the purchase agreement.
        </p>
      </div>
    </div>
  );
}
