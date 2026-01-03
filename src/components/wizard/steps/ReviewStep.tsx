'use client';

// src/components/wizard/steps/ReviewStep.tsx
// Step 9: Review all entered information before submission

import { ManualTransactionData } from '@/types/manual-wizard';
import { MapPin, User, Users, Building, Calendar } from 'lucide-react';
import { formatAllTimelineFields } from '@/lib/timeline/timeline-formatter';
import { formatDisplayDate } from '@/lib/date-utils';

interface Props {
  data: Partial<ManualTransactionData>;
}

export default function ReviewStep({ data }: Props) {
  // Format all timeline fields with calculated dates
  const formattedTimeline = formatAllTimelineFields(data.timeline);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review your information before creating the transaction.
      </p>

      {/* Property Information */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" />
          Property Information
        </div>
        <div className="pl-6 space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Address:</span>{' '}
            {data.propertyAddress || 'Not set'}
          </p>
          <p>
            <span className="text-muted-foreground">State:</span> {data.state || 'Not set'}
          </p>
          <p>
            <span className="text-muted-foreground">Type:</span>{' '}
            {data.transactionType === 'escrow' ? 'In Escrow' : 'Not set'}
          </p>
        </div>
      </div>

      {/* Buyers and Sellers - Two Column on Desktop */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Buyers */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Buyers
          </div>
          <div className="pl-6 space-y-1 text-sm">
            {data.buyerNames && data.buyerNames.length > 0 ? (
              data.buyerNames.filter(n => n.trim()).map((name, i) => (
                <p key={i}>• {name}</p>
              ))
            ) : (
              <p className="text-muted-foreground">No buyers added</p>
            )}
          </div>
        </div>

        {/* Sellers */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Sellers
          </div>
          <div className="pl-6 space-y-1 text-sm">
            {data.sellerNames && data.sellerNames.length > 0 ? (
              data.sellerNames.filter(n => n.trim()).map((name, i) => (
                <p key={i}>• {name}</p>
              ))
            ) : (
              <p className="text-muted-foreground">No sellers added</p>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4" />
          Timeline
        </div>
        <div className="pl-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Acceptance Date */}
            <div>
              <p className="text-muted-foreground text-xs">Acceptance Date</p>
              <p className="font-medium">
                {data.timeline?.acceptanceDate
                  ? formatDisplayDate(data.timeline.acceptanceDate)
                  : 'Not set'}
              </p>
            </div>

            {/* Closing Date */}
            <div>
              <p className="text-muted-foreground text-xs">Closing Date</p>
              <p className="font-medium">{formattedTimeline.closingDays?.displayText}</p>
            </div>

            {/* Initial Deposit */}
            <div>
              <p className="text-muted-foreground text-xs">Initial Deposit</p>
              <p className="font-medium">{formattedTimeline.initialDepositDays?.displayText}</p>
            </div>

            {/* Seller Delivery */}
            <div>
              <p className="text-muted-foreground text-xs">Seller Delivery</p>
              <p className="font-medium">{formattedTimeline.sellerDeliveryDays?.displayText}</p>
            </div>

            {/* Inspection Contingency */}
            {formattedTimeline.inspectionDays?.displayText !== 'Not set' && (
              <div>
                <p className="text-muted-foreground text-xs">Inspection Contingency</p>
                <p className="font-medium">{formattedTimeline.inspectionDays?.displayText}</p>
              </div>
            )}

            {/* Appraisal Contingency */}
            {formattedTimeline.appraisalDays?.displayText !== 'Not set' && (
              <div>
                <p className="text-muted-foreground text-xs">Appraisal Contingency</p>
                <p className="font-medium">{formattedTimeline.appraisalDays?.displayText}</p>
              </div>
            )}

            {/* Loan Contingency */}
            {formattedTimeline.loanDays?.displayText !== 'Not set' && (
              <div>
                <p className="text-muted-foreground text-xs">Loan Contingency</p>
                <p className="font-medium">{formattedTimeline.loanDays?.displayText}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agents - Two Column on Desktop */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Listing Agent */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building className="h-4 w-4" />
            Listing Agent
          </div>
          <div className="pl-6 space-y-1 text-sm">
            <p className="font-medium">{data.listingAgent?.name || 'Not set'}</p>
            <p className="text-muted-foreground">{data.listingAgent?.company || ''}</p>
            <p className="text-muted-foreground">{data.listingAgent?.phone || ''}</p>
            <p className="text-muted-foreground">{data.listingAgent?.email || ''}</p>
          </div>
        </div>

        {/* Buyer's Agent */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Buyer's Agent
            {data.isDualRepresentation && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Dual Rep
              </span>
            )}
          </div>
          <div className="pl-6 space-y-1 text-sm">
            <p className="font-medium">{data.buyersAgent?.name || 'Not set'}</p>
            <p className="text-muted-foreground">{data.buyersAgent?.company || ''}</p>
            <p className="text-muted-foreground">{data.buyersAgent?.phone || ''}</p>
            <p className="text-muted-foreground">{data.buyersAgent?.email || ''}</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          Click "Create Transaction" below to save this information.
        </p>
      </div>
    </div>
  );
}
