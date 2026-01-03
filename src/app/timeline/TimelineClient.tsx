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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAllTimelineEvents, TimelineEvent } from "@/lib/dates/extract-timeline-events";
import { Calendar as CalendarIcon, AlertCircle, CheckCircle, Clock, X } from "lucide-react";

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
  const [showOverdueDetails, setShowOverdueDetails] = useState(false);
  const [showUpcomingDetails, setShowUpcomingDetails] = useState(false);
  const [showCompletedDetails, setShowCompletedDetails] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TimelineEvent['status']>>({});
  const [dateOverrides, setDateOverrides] = useState<Record<string, Date>>({});
  const [dateMode, setDateMode] = useState<Record<string, 'calculated' | 'specific'>>({});
  const [calculatedDays, setCalculatedDays] = useState<Record<string, number>>({});

  const allEvents = useMemo(() => getAllTimelineEvents(parses), [parses]);

  // Apply status and date overrides, filter out not_applicable
  const events = useMemo(() => {
    return allEvents
      .map(event => {
        let finalStart = event.start;
        let finalEnd = event.end;

        // If in calculated mode and has calculated days, recalculate from acceptance
        if (dateMode[event.id] === 'calculated' && calculatedDays[event.id] !== undefined) {
          // Find acceptance date for this parse
          const acceptanceEvent = allEvents.find(e => e.parseId === event.parseId && e.type === 'acceptance');
          if (acceptanceEvent) {
            const daysToAdd = calculatedDays[event.id];
            finalStart = new Date(acceptanceEvent.start);
            finalStart.setDate(finalStart.getDate() + daysToAdd);
            finalEnd = new Date(finalStart);
          }
        } else if (dateOverrides[event.id]) {
          // Use specific date override
          finalStart = dateOverrides[event.id];
          finalEnd = dateOverrides[event.id];
        }

        return {
          ...event,
          status: statusOverrides[event.id] || event.status,
          start: finalStart,
          end: finalEnd,
        };
      })
      .filter(e => e.status !== 'not_applicable');
  }, [allEvents, statusOverrides, dateOverrides, dateMode, calculatedDays]);

  // Group events by status - EXCLUDE acceptance events from cards
  const upcomingEvents = events.filter(e => e.status === 'upcoming' && e.type !== 'acceptance');
  const overdueEvents = events.filter(e => e.status === 'overdue' && e.type !== 'acceptance');
  const completedEvents = events.filter(e => e.status === 'completed' && e.type !== 'acceptance');

  const upcomingCount = upcomingEvents.length;
  const overdueCount = overdueEvents.length;
  const completedCount = completedEvents.length;

  // Function to update event status
  const updateEventStatus = (eventId: string, newStatus: TimelineEvent['status']) => {
    setStatusOverrides(prev => ({
      ...prev,
      [eventId]: newStatus
    }));
  };

  // Function to update event date
  const updateEventDate = (eventId: string, newDate: Date) => {
    setDateOverrides(prev => ({
      ...prev,
      [eventId]: newDate
    }));
  };

  // Custom event style based on type and status
  const eventStyleGetter = (event: TimelineEvent) => {
    let backgroundColor = '#3b82f6'; // blue for default

    if (event.status === 'overdue') {
      backgroundColor = '#ef4444'; // red
    } else if (event.type === 'acceptance') {
      backgroundColor = '#14b8a6'; // teal for acceptance dates
    } else if (event.type === 'closing') {
      backgroundColor = '#10b981'; // green
    } else if (event.type === 'contingency') {
      backgroundColor = '#f59e0b'; // orange
    } else if (event.type === 'deposit') {
      backgroundColor = '#8b5cf6'; // purple
    } else if (event.type === 'deadline') {
      backgroundColor = '#3b82f6'; // blue
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

  // Render event details card with status controls
  const renderEventDetailsCard = (
    events: TimelineEvent[],
    title: string,
    titleColor: string,
    borderColor: string,
    bgColor: string,
    onClose: () => void
  ) => (
    <Card className={`${borderColor} ${bgColor}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className={titleColor}>{title} ({events.length})</span>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{event.title}</p>
                  {/* Date display with edit capability */}
                  <div className="mt-2 space-y-2">
                    {/* Acceptance dates: Specific date only (no toggle) */}
                    {event.type === 'acceptance' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Date:</span>
                        <input
                          type="date"
                          value={format(event.start, 'yyyy-MM-dd')}
                          onChange={(e) => {
                            const newDate = new Date(e.target.value);
                            if (!isNaN(newDate.getTime())) {
                              updateEventDate(event.id, newDate);
                            }
                          }}
                          onFocus={(e) => e.target.showPicker?.()}
                          className="text-xs border rounded px-2 py-1"
                        />
                        <span className="text-xs text-muted-foreground">(specific only)</span>
                      </div>
                    ) : (
                      <>
                        {/* Toggle between Calculated and Specific for non-acceptance */}
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`date-mode-card-${event.id}`}
                              checked={dateMode[event.id] !== 'calculated'}
                              onChange={() => {
                                setDateMode(prev => {
                                  const newMode = { ...prev };
                                  delete newMode[event.id];
                                  return newMode;
                                });
                              }}
                              className="w-3 h-3"
                            />
                            <span className="text-xs">Specific Date</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`date-mode-card-${event.id}`}
                              checked={dateMode[event.id] === 'calculated'}
                              onChange={() => {
                                setDateMode(prev => ({ ...prev, [event.id]: 'calculated' }));
                              }}
                              className="w-3 h-3"
                            />
                            <span className="text-xs">Days from Acceptance</span>
                          </label>
                        </div>

                        {/* Show appropriate input based on mode */}
                        {dateMode[event.id] === 'calculated' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={calculatedDays[event.id] ?? 0}
                              onChange={(e) => {
                                setCalculatedDays(prev => ({
                                  ...prev,
                                  [event.id]: parseInt(e.target.value) || 0
                                }));
                              }}
                              className="w-16 text-xs border rounded px-2 py-1"
                            />
                            <span className="text-xs text-muted-foreground">days after acceptance</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Due:</span>
                            <input
                              type="date"
                              value={format(event.start, 'yyyy-MM-dd')}
                              onChange={(e) => {
                                const newDate = new Date(e.target.value);
                                if (!isNaN(newDate.getTime())) {
                                  updateEventDate(event.id, newDate);
                                }
                              }}
                              onFocus={(e) => e.target.showPicker?.()}
                              className="text-xs border rounded px-2 py-1"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {event.propertyAddress && (
                    <p className="text-sm text-muted-foreground">
                      Property: {event.propertyAddress}
                    </p>
                  )}
                  {/* Status dropdown for all events */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <select
                      value={event.status}
                      onChange={(e) => updateEventStatus(event.id, e.target.value as TimelineEvent['status'])}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="overdue">Past Due</option>
                      <option value="completed">Completed</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </div>
                </div>
                <Badge variant={event.status === 'overdue' ? 'destructive' : 'default'}>
                  {event.type}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Custom Event component with hover tooltip
  const CustomEvent = ({ event }: { event: TimelineEvent }) => {
    return (
      <div className="group relative h-full">
        <div className="truncate">{event.title}</div>
        {/* Hover Tooltip */}
        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="space-y-2 text-xs">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{event.title}</p>
            </div>
            {event.propertyAddress && (
              <div>
                <p className="text-gray-500 dark:text-gray-400">Property:</p>
                <p className="text-gray-900 dark:text-gray-100">{event.propertyAddress}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 dark:text-gray-400">Type:</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{event.type}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Status:</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{event.status}</p>
            </div>
          </div>
        </div>
      </div>
    );
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

      {/* Expandable Event Details Cards */}
      {showOverdueDetails && renderEventDetailsCard(
        overdueEvents,
        'Past Due Events',
        'text-red-700',
        'border-red-200',
        'bg-red-50',
        () => setShowOverdueDetails(false)
      )}

      {showUpcomingDetails && renderEventDetailsCard(
        upcomingEvents,
        'Upcoming Events',
        'text-blue-700',
        'border-blue-200',
        'bg-blue-50',
        () => setShowUpcomingDetails(false)
      )}

      {showCompletedDetails && renderEventDetailsCard(
        completedEvents,
        'Completed Events',
        'text-green-700',
        'border-green-200',
        'bg-green-50',
        () => setShowCompletedDetails(false)
      )}

      {/* Stats Cards - Rearranged: Overdue, Upcoming, Completed */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Past Due Card */}
        <Card
          className="cursor-pointer hover:bg-red-50 transition-colors"
          onClick={() => setShowOverdueDetails(!showOverdueDetails)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-sm text-muted-foreground">
                  Past Due {overdueCount > 0 && '(click to view)'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Card */}
        <Card
          className="cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => setShowUpcomingDetails(!showUpcomingDetails)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingCount}</p>
                <p className="text-sm text-muted-foreground">
                  Upcoming {upcomingCount > 0 && '(click to view)'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completed Card */}
        <Card
          className="cursor-pointer hover:bg-green-50 transition-colors"
          onClick={() => setShowCompletedDetails(!showCompletedDetails)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">
                  Completed {completedCount > 0 && '(click to view)'}
                </p>
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
                components={{
                  event: CustomEvent,
                }}
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

      {/* Floating Modal for Selected Calendar Event */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Event Details</span>
              <Badge
                variant={
                  selectedEvent?.status === 'overdue'
                    ? 'destructive'
                    : 'default'
                }
              >
                {selectedEvent?.type}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedEvent.title}</p>
              </div>

              {/* Date editing */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Event Date</p>

                {/* Acceptance dates: Specific date only (no toggle) */}
                {selectedEvent.type === 'acceptance' ? (
                  <div>
                    <input
                      type="date"
                      value={format(selectedEvent.start, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        if (!isNaN(newDate.getTime())) {
                          updateEventDate(selectedEvent.id, newDate);
                        }
                      }}
                      onFocus={(e) => e.target.showPicker?.()}
                      className="w-full text-sm border rounded px-3 py-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Acceptance date (specific date only)
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Toggle between Calculated and Specific for non-acceptance dates */}
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`date-mode-${selectedEvent.id}`}
                          checked={dateMode[selectedEvent.id] !== 'calculated'}
                          onChange={() => {
                            setDateMode(prev => {
                              const newMode = { ...prev };
                              delete newMode[selectedEvent.id];
                              return newMode;
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Specific Date</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`date-mode-${selectedEvent.id}`}
                          checked={dateMode[selectedEvent.id] === 'calculated'}
                          onChange={() => {
                            setDateMode(prev => ({ ...prev, [selectedEvent.id]: 'calculated' }));
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Days from Acceptance</span>
                      </label>
                    </div>

                    {/* Show appropriate input based on mode */}
                    {dateMode[selectedEvent.id] === 'calculated' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={calculatedDays[selectedEvent.id] ?? 0}
                          onChange={(e) => {
                            setCalculatedDays(prev => ({
                              ...prev,
                              [selectedEvent.id]: parseInt(e.target.value) || 0
                            }));
                          }}
                          className="w-24 text-sm border rounded px-3 py-2"
                        />
                        <span className="text-sm text-muted-foreground">days after acceptance</span>
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={format(selectedEvent.start, 'yyyy-MM-dd')}
                        onChange={(e) => {
                          const newDate = new Date(e.target.value);
                          if (!isNaN(newDate.getTime())) {
                            updateEventDate(selectedEvent.id, newDate);
                          }
                        }}
                        onFocus={(e) => e.target.showPicker?.()}
                        className="w-full text-sm border rounded px-3 py-2"
                      />
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      Original: {format(allEvents.find(ev => ev.id === selectedEvent.id)?.start || selectedEvent.start, "MMMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>

              {selectedEvent.propertyAddress && (
                <div>
                  <p className="text-sm text-muted-foreground">Property</p>
                  <p className="font-medium">{selectedEvent.propertyAddress}</p>
                </div>
              )}

              {/* Status Change */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Change Status</p>
                <select
                  value={selectedEvent.status}
                  onChange={(e) => {
                    updateEventStatus(selectedEvent.id, e.target.value as TimelineEvent['status']);
                  }}
                  className="w-full text-sm border rounded px-3 py-2"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="overdue">Past Due</option>
                  <option value="completed">Completed</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#14b8a6]" />
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
