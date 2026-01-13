// src/app/timeline/TimelineClient.tsx
// Version: 2.0.0 - Major UI update
"use client";

import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isSameDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { 
  getAllTimelineEvents, 
  TimelineEvent 
} from "@/lib/dates/extract-timeline-events";
import { 
  Calendar as CalendarIcon, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Search, 
  Lock, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  X,
  MapPin,
  Tag,
  FileText
} from "lucide-react";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const EVENT_TYPES = [
  { id: "acceptance", label: "Acceptance", color: "#14b8a6" },
  { id: "closing", label: "Closing", color: "#10b981" },
  { id: "contingency", label: "Contingency", color: "#f59e0b" },
  { id: "deposit", label: "Deposit", color: "#8b5cf6" },
  { id: "deadline", label: "Deadline", color: "#3b82f6" },
  { id: "overdue", label: "Overdue", color: "#ef4444" },
];

interface TimelineClientProps {
  parses: any[];
}

export default function TimelineClient({ parses }: TimelineClientProps) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>("month");
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(EVENT_TYPES.map(t => t.id));
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const rawEvents = useMemo(() => getAllTimelineEvents(parses), [parses]);

  // Live Filtering Logic
  const filteredEvents = useMemo(() => {
    return rawEvents.filter(event => {
      const matchesSearch = 
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        event.propertyAddress?.toLowerCase().includes(search.toLowerCase());
      
      const isOverdue = event.status === 'overdue';
      const typeMatch = isOverdue 
        ? selectedTypes.includes('overdue') 
        : selectedTypes.includes(event.type);

      return matchesSearch && typeMatch;
    });
  }, [rawEvents, search, selectedTypes]);

  // Group events by status for sidebar stats
  const stats = {
    upcoming: rawEvents.filter(e => e.status === 'upcoming').length,
    overdue: rawEvents.filter(e => e.status === 'overdue').length,
    total: rawEvents.length
  };

  const handleSelectAll = () => {
    if (selectedTypes.length === EVENT_TYPES.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(EVENT_TYPES.map(t => t.id));
    }
  };

  const eventStyleGetter = (event: TimelineEvent) => {
    let backgroundColor = '#3b82f6';
    if (event.status === 'overdue') backgroundColor = '#ef4444';
    else if (event.type === 'closing') backgroundColor = '#10b981';
    else if (event.type === 'contingency') backgroundColor = '#f59e0b';
    else if (event.type === 'deposit') backgroundColor = '#8b5cf6';
    else if (event.type === 'acceptance') backgroundColor = '#14b8a6';

    return {
      style: { 
        backgroundColor, 
        borderRadius: '4px', 
        opacity: 0.9, 
        color: 'white', 
        border: 'none', 
        display: 'block', 
        fontSize: '11px', 
        fontWeight: 500 
      },
    };
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      {/* --- NESTED SIDEBAR --- */}
      <aside className="w-[300px] border-r flex flex-col p-6 space-y-6 overflow-y-auto shrink-0 bg-white z-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track all contract dates and deadlines
          </p>
        </div>

        {/* Live Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search properties or tasks..." 
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* View Switcher (Segmented Control) */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-wider">View Mode</p>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as View)} className="justify-start bg-slate-100/50 p-1 rounded-md">
            <ToggleGroupItem value="day" className="flex-1 text-xs h-7 data-[state=on]:bg-white data-[state=on]:shadow-sm">Day</ToggleGroupItem>
            <ToggleGroupItem value="week" className="flex-1 text-xs h-7 data-[state=on]:bg-white data-[state=on]:shadow-sm">Week</ToggleGroupItem>
            <ToggleGroupItem value="month" className="flex-1 text-xs h-7 data-[state=on]:bg-white data-[state=on]:shadow-sm">Month</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Navigation (Segmented Control) */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-wider">Navigate</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDate(localizer.add(date, -1, view as any))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant={isSameDay(date, new Date()) ? "secondary" : "outline"} 
              className="flex-1 h-8 text-xs font-medium"
              onClick={() => setDate(new Date())}
            >
              Current
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDate(localizer.add(date, 1, view as any))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Filter By Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2 tracking-wider">
              <Filter className="h-3 w-3" /> Filter By
            </p>
            <button onClick={handleSelectAll} className="text-[10px] font-medium text-primary hover:underline transition-all">
              {selectedTypes.length === EVENT_TYPES.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="space-y-2.5">
            {EVENT_TYPES.map((type) => (
              <label key={type.id} className="flex items-center gap-3 px-1 cursor-pointer group">
                <Checkbox 
                  checked={selectedTypes.includes(type.id)}
                  onCheckedChange={(checked) => {
                    setSelectedTypes(prev => checked 
                      ? [...prev, type.id] 
                      : prev.filter(t => t !== type.id)
                    );
                  }}
                />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: type.color }} />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                  {type.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Assigned To Placeholder */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-wider">Assigned To</p>
          <div className="relative flex items-center justify-between p-2.5 rounded-lg border bg-slate-50 border-dashed border-slate-300 opacity-70">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Agent Filters</span>
            </div>
            <Badge className="text-[9px] uppercase font-bold bg-blue-600 hover:bg-blue-600 text-white border-none scale-90 origin-right">Teams</Badge>
          </div>
        </div>

        <Separator />

        {/* Dense Stats Section */}
        <div className="space-y-3 px-1 pt-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5 text-slate-600 font-medium">
              <Clock className="h-4 w-4 text-blue-500" /> <span>Upcoming</span>
            </div>
            <span className="font-bold tabular-nums">{stats.upcoming}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5 text-slate-600 font-medium">
              <AlertCircle className="h-4 w-4 text-red-500" /> <span>Overdue</span>
            </div>
            <span className="font-bold text-red-600 tabular-nums">{stats.overdue}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5 text-slate-600 font-medium">
              <CheckCircle className="h-4 w-4 text-emerald-500" /> <span>Total</span>
            </div>
            <span className="font-bold tabular-nums">{stats.total}</span>
          </div>
        </div>
      </aside>

      {/* --- MAIN CALENDAR AREA --- */}
      {/* --- MAIN CALENDAR AREA --- */}
<main className="flex-1 overflow-hidden bg-slate-50/20 relative flex flex-col">
  {/* Dynamic Calendar Header */}
  <div className="px-6 pt-6 flex justify-end items-center">
    <h2 className="text-xl font-bold text-slate-800">
      {view === 'month' && format(date, "MMMM, yyyy")}
      {view === 'week' && format(date, "MMMM, yyyy")}
      {view === 'day' && format(date, "MMMM d, yyyy")}
    </h2>
  </div>

  <div className="flex-1 p-6">
    <Calendar
      localizer={localizer}
      events={filteredEvents}
      // ... rest of your props
      toolbar={false} // Keeping this false as we are building our own
      date={date}
      view={view}
      onNavigate={setDate}
      onView={setView}
      // ... rest of your existing calendar code
    />
  </div>
</main>

      {/* --- RIGHT SIDEBAR (Event Details Slide-over) --- */}
      <aside 
        className={`fixed top-0 right-0 h-full w-[380px] bg-white border-l shadow-[-10px_0_30px_rgba(0,0,0,0.05)] transform transition-transform duration-300 ease-in-out z-50 ${
          selectedEvent ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedEvent && (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50/80 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-400" />
                <h2 className="font-bold text-lg text-slate-900 tracking-tight">Timeline Detail</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedEvent(null)}
                className="rounded-full h-9 w-9 hover:bg-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-8 space-y-10 overflow-y-auto">
              {/* Header Info */}
              <div className="space-y-4">
                <Badge 
                  className={`uppercase text-[10px] font-bold tracking-[0.1em] px-2.5 py-1 ${
                    selectedEvent.status === 'overdue' 
                    ? 'bg-red-100 text-red-700 hover:bg-red-100' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {selectedEvent.status}
                </Badge>
                <h3 className="text-2xl font-extrabold leading-[1.2] text-slate-900">{selectedEvent.title}</h3>
              </div>

              {/* Grid Details */}
              <div className="space-y-8">
                <div className="flex items-start gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Date</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {format(selectedEvent.start, "EEEE, MMMM do, yyyy")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Tag className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Event Type</p>
                    <p className="text-sm font-semibold text-slate-800 capitalize">{selectedEvent.type}</p>
                  </div>
                </div>

                {selectedEvent.propertyAddress && (
                  <div className="flex items-start gap-4 group">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <MapPin className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Property Address</p>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                        {selectedEvent.propertyAddress}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 space-y-3">
                <Button className="w-full h-11 font-bold shadow-sm" variant="default">
                  View Full Transaction
                </Button>
                <Button className="w-full h-11 font-bold text-slate-600" variant="outline" onClick={() => setSelectedEvent(null)}>
                  Close Details
                </Button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
