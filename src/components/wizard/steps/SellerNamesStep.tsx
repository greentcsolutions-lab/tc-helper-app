'use client';

// src/components/wizard/steps/SellerNamesStep.tsx
// Step 4: Seller Names (multi-entry, up to 4)

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ManualTransactionData } from '@/types/manual-wizard';
import { Plus, X } from 'lucide-react';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

export default function SellerNamesStep({ data, updateData }: Props) {
  const sellerNames = data.sellerNames || [''];
  const MAX_SELLERS = 4;

  const handleNameChange = (index: number, value: string) => {
    const updated = [...sellerNames];
    updated[index] = value;
    updateData({ sellerNames: updated });
  };

  const addSeller = () => {
    if (sellerNames.length < MAX_SELLERS) {
      updateData({ sellerNames: [...sellerNames, ''] });
    }
  };

  const removeSeller = (index: number) => {
    if (sellerNames.length > 1) {
      const updated = sellerNames.filter((_, i) => i !== index);
      updateData({ sellerNames: updated });
    }
  };

  const filledSellers = sellerNames.filter((name) => name.trim()).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Enter the seller name(s) for this transaction. You can add up to 4
          sellers.
        </p>
      </div>

      <div className="space-y-4">
        {sellerNames.map((name, index) => (
          <div key={index} className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Seller {index + 1} {index === 0 && '(Required)'}
              </label>
              <Input
                placeholder="Full Name"
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
              />
            </div>
            {sellerNames.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeSeller(index)}
                className="mt-6"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {sellerNames.length < MAX_SELLERS && (
        <Button
          variant="outline"
          onClick={addSeller}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Seller
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
