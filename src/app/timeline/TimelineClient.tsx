// src/app/timeline/TimelineClient.tsx
// Version: 1.0.0 - Interactive calendar view with react-big-calendar
"use client";

import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllTimelineEvents, TimelineEvent } from "@/lib/dates/extract-timeline-events";
import { Calendar as CalendarIcon, AlertCircle, CheckCircle, Clock } from "lucide-react";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface TimelineClientProps {
  parses: any[];
}

export default function TimelineClient({ parses }: TimelineClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const events = useMemo(() => getAllTimelineEvents(parses), [parses]);

  // Group events by status
  const upcomingCount = events.filter(e => e.status === 'upcoming').length;
  const overdueCount = events.filter(e => e.status === 'overdue').length;

  // Custom event style based on type and status
  const eventStyleGetter = (event: TimelineEvent) => {
    let backgroundColor = '#3b82f6'; // blue for default

    if (event.status === 'overdue') {
      backgroundColor = '#ef4444'; // red
    } else if (event.type === 'acceptance') {
      backgroundColor = '#6366f1'; // indigo for acceptance dates
    } else if (event.type === 'closing') {
      backgroundColor = '#10b981'; // green
    } else if (event.type === 'contingency') {
      backgroundColor = '#f59e0b'; // orange
    } else if (event.type === 'deposit') {
      backgroundColor = '#8b5cf6'; // purple
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 500,
      },
    };
  };

  const handleSelectEvent = (event: TimelineEvent) => {
    setSelectedEvent(event);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Timeline</h1>
          <p className="text-muted-foreground text-lg">
            All important dates from your contracts
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingCount}</p>
                <p className="text-sm text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Contract Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="h-[600px]">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "100%" }}
                eventPropGetter={eventStyleGetter}
                onSelectEvent={handleSelectEvent}
                views={["month", "week", "agenda"]}
                defaultView="month"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Events Yet</h3>
              <p className="text-muted-foreground max-w-md">
                Upload and parse contracts to see important dates and deadlines here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Event Details */}
      {selectedEvent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Event Details</span>
              <Badge
                variant={
                  selectedEvent.status === 'overdue'
                    ? 'destructive'
                    : 'default'
                }
              >
                {selectedEvent.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Title</p>
              <p className="font-medium">{selectedEvent.title}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">
                {format(selectedEvent.start, "MMMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium capitalize">{selectedEvent.type}</p>
            </div>
            {selectedEvent.propertyAddress && (
              <div>
                <p className="text-sm text-muted-foreground">Property</p>
                <p className="font-medium">{selectedEvent.propertyAddress}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#6366f1]" />
              <span className="text-sm">Acceptance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#10b981]" />
              <span className="text-sm">Closing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#f59e0b]" />
              <span className="text-sm">Contingency</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#8b5cf6]" />
              <span className="text-sm">Deposit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#3b82f6]" />
              <span className="text-sm">Deadline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#ef4444]" />
              <span className="text-sm">Overdue</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
