// src/components/dashboard/NextClosingCard.tsx
// Version: 1.0.0 - Dashboard widget showing next closing date(s)
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { getAllTimelineEvents, TimelineEvent } from "@/lib/dates/extract-timeline-events";
import Link from "next/link";

interface NextClosingCardProps {
  parses: any[];
}

/**
 * Simplifies a full address to just the street address
 * Example: "123 Main St, Los Angeles, CA 90001" -> "123 Main St"
 */
function simplifyAddress(address: string | undefined): string {
  if (!address) return "Unknown Property";

  // Split by comma and take the first part (street address)
  const parts = address.split(',');
  return parts[0].trim();
}

/**
 * Get all closings on the next upcoming closing date
 * Returns all properties that close on the same date if multiple exist
 */
function getNextClosings(parses: any[]): TimelineEvent[] {
  const allEvents = getAllTimelineEvents(parses);

  // Filter for only closing events that are upcoming
  const upcomingClosings = allEvents.filter(
    event => event.type === 'closing' && event.status === 'upcoming'
  );

  if (upcomingClosings.length === 0) return [];

  // Get the earliest closing date
  const nextClosingDate = upcomingClosings[0].start;

  // Return all closings that occur on that date
  return upcomingClosings.filter(
    event => event.start.getTime() === nextClosingDate.getTime()
  );
}

export default function NextClosingCard({ parses }: NextClosingCardProps) {
  const nextClosings = getNextClosings(parses);

  if (nextClosings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Next Closing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Home className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No upcoming closings
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // All closings in the array have the same date (the next closing date)
  const closingDate = nextClosings[0].start;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Next Closing
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/timeline">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {nextClosings.map((closing) => (
          <Link
            key={closing.id}
            href={`/timeline?eventId=${closing.id}`}
            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="shrink-0 mt-0.5" role="img" aria-label="closing">
              <Home className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-tight">
                {simplifyAddress(closing.propertyAddress)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(closingDate, "MMMM d, yyyy")}
              </p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
