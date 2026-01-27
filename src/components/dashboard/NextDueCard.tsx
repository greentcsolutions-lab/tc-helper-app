// src/components/dashboard/NextDueCard.tsx
// Version: 2.0.0 - Dashboard widget showing next upcoming event(s) on the same date
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle, ArrowRight, Home, ClipboardList, DollarSign, AlarmClock, CheckCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { getNextEventsByDate, TimelineEvent } from "@/lib/dates/extract-timeline-events";
import Link from "next/link";

interface NextDueCardProps {
  parses: any[];
}

/**
 * Simplifies a full address to just the street address
 * Example: "123 Main St, Los Angeles, CA 90001" -> "123 Main St"
 */
function simplifyAddress(address: string | undefined): string {
  if (!address) return "";

  // Split by comma and take the first part (street address)
  const parts = address.split(',');
  return parts[0].trim();
}

export default function NextDueCard({ parses }: NextDueCardProps) {
  const upcomingEvents = getNextEventsByDate(parses);

  if (upcomingEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Next Due
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No upcoming deadlines. You're all caught up!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getEventIcon = (type: TimelineEvent['type']) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'closing':
        return <Home className={iconClass} />;
      case 'contingency':
        return <ClipboardList className={iconClass} />;
      case 'deposit':
        return <DollarSign className={iconClass} />;
      case 'deadline':
        return <AlarmClock className={iconClass} />;
      case 'acceptance':
        return <CheckCircle className={iconClass} />;
      default:
        return <Calendar className={iconClass} />;
    }
  };

  const getTypeColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'closing':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'contingency':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'deposit':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'acceptance':
        return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
      case 'deadline':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Next Due
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/timeline">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingEvents.map((event) => (
          <Link
            key={event.id}
            href={`/timeline?eventId=${event.id}`}
            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="shrink-0 mt-0.5" role="img" aria-label={event.type}>
              {getEventIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-sm leading-tight line-clamp-2">
                  {event.title}
                </p>
                <Badge
                  className={`${getTypeColor(event.type)} shrink-0 text-xs`}
                  variant="outline"
                >
                  {event.type}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{format(event.start, "MMM d, yyyy")}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {formatDistanceToNow(event.start, { addSuffix: true })}
                </span>
              </div>
              {event.propertyAddress && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {simplifyAddress(event.propertyAddress)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
