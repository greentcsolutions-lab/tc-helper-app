// src/components/dashboard/NextDueCard.tsx
// Version: 1.0.0 - Dashboard widget showing next 5 upcoming deadlines
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle, ArrowRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { getUpcomingEvents, TimelineEvent } from "@/lib/dates/extract-timeline-events";
import Link from "next/link";

interface NextDueCardProps {
  parses: any[];
}

export default function NextDueCard({ parses }: NextDueCardProps) {
  const upcomingEvents = getUpcomingEvents(parses, 5);

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
    switch (type) {
      case 'closing':
        return '🏠';
      case 'contingency':
        return '📋';
      case 'deposit':
        return '💰';
      case 'deadline':
        return '⏰';
      default:
        return '📅';
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
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
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
          <div
            key={event.id}
            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="text-2xl" role="img" aria-label={event.type}>
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
                  {event.propertyAddress}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
