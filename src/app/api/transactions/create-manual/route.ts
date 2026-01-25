// src/app/api/transactions/create-manual/route.ts
// API route for creating transactions manually via the wizard

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { ManualTransactionData } from '@/types/manual-wizard';
import { calculateTimelineDate } from '@/lib/date-utils';

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: {
        id: true,
        planType: true,
        quota: true,
        parseLimit: true,
        parseCount: true,
        parseResetDate: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if parse count needs to be reset (monthly refresh for BASIC and STANDARD plans)
    const now = new Date();
    let parseCount = dbUser.parseCount;

    // Only reset for paid plan users (FREE plan never resets)
    if ((dbUser.planType === 'BASIC' || dbUser.planType === 'STANDARD') && dbUser.parseResetDate && now >= dbUser.parseResetDate) {
      parseCount = 0;

      // Calculate next reset date (one month from now)
      const nextReset = new Date(now);
      nextReset.setMonth(nextReset.getMonth() + 1);

      // Update user with reset values
      await db.user.update({
        where: { id: dbUser.id },
        data: {
          parseCount: 0,
          parseResetDate: nextReset,
        },
      });
    }

    // Check parse limit
    if (parseCount >= dbUser.parseLimit) {
      const errorMessage = dbUser.planType === 'FREE'
        ? 'Free tier parse limit reached'
        : 'Monthly transaction limit reached';

      return NextResponse.json(
        {
          error: errorMessage,
          parseCount,
          parseLimit: dbUser.parseLimit,
        },
        { status: 402 }
      );
    }

    // Check concurrent transaction quota (count only non-archived parses)
    const activeParseCount = await db.parse.count({
      where: {
        userId: dbUser.id,
        archived: false,
      },
    });

    if (activeParseCount >= dbUser.quota) {
      return NextResponse.json(
        {
          error: 'Concurrent transaction limit reached',
          activeParseCount,
          quota: dbUser.quota,
          message: 'Archive or delete existing transactions to create new ones',
        },
        { status: 402 }
      );
    }

    const data: ManualTransactionData = await req.json();

    // Validate required fields
    if (!data.propertyAddress || !data.state) {
      return NextResponse.json(
        { error: 'Property address and state are required' },
        { status: 400 }
      );
    }

    if (!data.buyerNames || data.buyerNames.filter((n) => n.trim()).length === 0) {
      return NextResponse.json(
        { error: 'At least one buyer name is required' },
        { status: 400 }
      );
    }

    if (!data.sellerNames || data.sellerNames.filter((n) => n.trim()).length === 0) {
      return NextResponse.json(
        { error: 'At least one seller name is required' },
        { status: 400 }
      );
    }

    // Calculate absolute dates from timeline
    const timeline = data.timeline;
    const acceptanceDate = timeline.acceptanceDate;

    const calculateDate = (value: number | string, useBusinessDays: boolean): string | null => {
      if (!value) return null;

      // If it's already a date string (YYYY-MM-DD), return it
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return value;
      }

      // If it's a number of days, calculate from acceptance date
      if (typeof value === 'number' && acceptanceDate) {
        return calculateTimelineDate(acceptanceDate, value, useBusinessDays);
      }

      return null;
    };

    const initialDepositDueDate = calculateDate(timeline.initialDepositDays, true);
    const sellerDeliveryDate = calculateDate(timeline.sellerDeliveryDays, false);
    const closingDate = calculateDate(timeline.closingDays, false);

    // Calculate contingency dates
    const inspectionDate = calculateDate(timeline.inspectionDays, false);
    const appraisalDate = calculateDate(timeline.appraisalDays, false);
    const loanDate = calculateDate(timeline.loanDays, false);

    // Build timelineEvents array
    const timelineEvents = [];

    if (acceptanceDate) {
      timelineEvents.push({
        date: acceptanceDate,
        title: 'Acceptance Date',
        type: 'info',
        description: 'Contract fully executed by all parties',
      });
    }

    if (initialDepositDueDate) {
      timelineEvents.push({
        date: initialDepositDueDate,
        title: 'Initial Deposit Due',
        type: 'critical',
        description: 'Earnest money deposit due',
      });
    }

    if (sellerDeliveryDate) {
      timelineEvents.push({
        date: sellerDeliveryDate,
        title: 'Seller Delivery of Disclosures',
        type: 'warning',
        description: 'Seller must deliver all required disclosures',
      });
    }

    if (timeline.inspectionDays) {
      if (inspectionDate) {
        timelineEvents.push({
          date: inspectionDate,
          title: 'Inspection Contingency',
          type: 'warning',
          description: 'Inspection contingency deadline',
        });
      }
    }

    if (timeline.appraisalDays) {
      if (appraisalDate) {
        timelineEvents.push({
          date: appraisalDate,
          title: 'Appraisal Contingency',
          type: 'warning',
          description: 'Appraisal contingency deadline',
        });
      }
    }

    if (timeline.loanDays) {
      if (loanDate) {
        timelineEvents.push({
          date: loanDate,
          title: 'Loan Contingency',
          type: 'warning',
          description: 'Loan contingency deadline',
        });
      }
    }

    if (closingDate) {
      timelineEvents.push({
        date: closingDate,
        title: 'Closing Date',
        type: 'critical',
        description: 'Transaction closing date',
      });
    }

    // Create Parse record and increment UserUsage counter
    const parse = await db.$transaction(async (tx) => {
      const newParse = await tx.parse.create({
        data: {
          userId: dbUser.id,
          fileName: `Manual Entry - ${data.propertyAddress}`,
          state: data.state,
          status: 'COMPLETED',

          // Core fields
          transactionType: data.transactionType,
          buyerNames: data.buyerNames.filter((n) => n.trim()),
          sellerNames: data.sellerNames.filter((n) => n.trim()),
          propertyAddress: data.propertyAddress,
          effectiveDate: acceptanceDate,
          initialDepositDueDate,
          sellerDeliveryOfDisclosuresDate: sellerDeliveryDate,
          closingDate,

          // Contingencies (calculated dates saved as strings)
          contingencies: {
            inspectionDays: inspectionDate,
            appraisalDays: appraisalDate,
            loanDays: loanDate,
            saleOfBuyerProperty: false, // Default to false for manual entries
          },

          // Broker information with detailed agent data
          brokers: {
            listingAgentDetails: data.listingAgent,
            buyersAgentDetails: data.buyersAgent,
            // Legacy fields for compatibility
            listingAgent: data.listingAgent.name,
            listingBrokerage: data.listingAgent.company,
            sellingAgent: data.buyersAgent.name,
            sellingBrokerage: data.buyersAgent.company,
          },

          // Timeline events
          timelineEvents,

          // Extraction details with timeline source tracking
          extractionDetails: {
            route: 'manual',
            createdVia: 'wizard',
            isDualRepresentation: data.isDualRepresentation,
            // Preserve source information for future features
            timelineSource: {
              acceptanceDate: timeline.acceptanceDate,
              closingDays: timeline.closingDays,
              initialDepositDays: timeline.initialDepositDays,
              sellerDeliveryDays: timeline.sellerDeliveryDays,
              inspectionDays: timeline.inspectionDays || null,
              appraisalDays: timeline.appraisalDays || null,
              loanDays: timeline.loanDays || null,
            },
          },

          // Set finalized timestamp
          finalizedAt: new Date(),

          // Mark as not missing SCOs since it's manually created
          missingSCOs: false,
        },
      });

      // Increment UserUsage counter and parseCount
      await tx.userUsage.upsert({
        where: { userId: dbUser.id },
        create: {
          userId: dbUser.id,
          parses: 1,
          lastParse: new Date(),
        },
        update: {
          parses: { increment: 1 },
          lastParse: new Date(),
        },
      });
      console.log(`[create-manual:${newParse.id}] Incremented user usage counter`);

      // Increment parseCount for monthly limit tracking
      await tx.user.update({
        where: { id: dbUser.id },
        data: {
          parseCount: {
            increment: 1,
          },
        },
      });
      console.log(`[create-manual:${newParse.id}] Incremented parseCount`);

      return newParse;
    });

    return NextResponse.json({
      success: true,
      parseId: parse.id,
      message: 'Transaction created successfully',
    });
  } catch (error) {
    console.error('Error creating manual transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
