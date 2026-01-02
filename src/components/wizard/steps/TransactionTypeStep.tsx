'use client';

// src/components/wizard/steps/TransactionTypeStep.tsx
// Step 2: Transaction Type selection (Listing vs In Escrow)

import { ManualTransactionData } from '@/types/manual-wizard';
import { Card } from '@/components/ui/card';
import { Home, FileCheck, Lock } from 'lucide-react';

interface Props {
  data: Partial<ManualTransactionData>;
  updateData: (updates: Partial<ManualTransactionData>) => void;
}

export default function TransactionTypeStep({ data, updateData }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Select the type of transaction you're creating.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Listing Option - Grayed Out */}
        <Card
          className="relative p-6 border-2 border-dashed bg-muted/30 cursor-not-allowed opacity-60"
        >
          <div className="absolute top-4 right-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Home className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-muted-foreground">
                Listing
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Create a new listing for a property
              </p>
            </div>
            <div className="bg-orange-100 border border-orange-300 rounded-md px-4 py-2">
              <p className="text-xs font-medium text-orange-800">
                Coming Soon
              </p>
            </div>
          </div>
        </Card>

        {/* In Escrow Option - Active */}
        <Card
          onClick={() => updateData({ transactionType: 'escrow' })}
          className={`p-6 border-2 cursor-pointer transition-all hover:shadow-md ${
            data.transactionType === 'escrow'
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                data.transactionType === 'escrow'
                  ? 'bg-blue-500'
                  : 'bg-gray-100'
              }`}
            >
              <FileCheck
                className={`h-8 w-8 ${
                  data.transactionType === 'escrow'
                    ? 'text-white'
                    : 'text-gray-600'
                }`}
              />
            </div>
            <div>
              <h3
                className={`text-lg font-semibold ${
                  data.transactionType === 'escrow'
                    ? 'text-blue-900'
                    : 'text-foreground'
                }`}
              >
                In Escrow (Transaction)
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Track an active transaction with timelines and contingencies
              </p>
            </div>
            {data.transactionType === 'escrow' && (
              <div className="bg-blue-500 text-white rounded-md px-4 py-2">
                <p className="text-xs font-medium">Selected</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {data.transactionType === 'escrow' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            You've selected <span className="font-semibold">In Escrow</span>. The
            wizard will guide you through setting up buyer/seller information,
            agent details, and transaction timelines.
          </p>
        </div>
      )}
    </div>
  );
}
