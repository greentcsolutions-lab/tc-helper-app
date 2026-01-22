// src/components/settings/CalendarSyncSettings.tsx
"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, RefreshCw, Loader2, CalendarCheck, Lock } from "lucide-react";
import { toast } from "sonner";

// Beta testing email whitelist
const BETA_TESTER_EMAILS = [
  "greentcsolutions@gmail.com",
  "chrisiscool23@gmail.com",
];

interface CalendarSettings {
  syncEnabled: boolean;
  includeFullDetails: boolean;
  syncNonAppEvents: boolean;
  excludeFinancialData: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  webhookExpiration: string | null;
}

export default function CalendarSyncSettings() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings>({
    syncEnabled: true,
    includeFullDetails: true,
    syncNonAppEvents: true,
    excludeFinancialData: true,
    lastSyncAt: null,
    lastSyncError: null,
    webhookExpiration: null,
  });

  // Check if user is in beta testing whitelist
  const isBetaTester = user?.primaryEmailAddress?.emailAddress &&
    BETA_TESTER_EMAILS.includes(user.primaryEmailAddress.emailAddress);

  // Load settings on mount
  useEffect(() => {
    if (isBetaTester) {
      loadSettings();
    } else {
      setIsLoading(false);
    }

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('calendar_connected')) {
      toast.success('Google Calendar connected successfully!');
      loadSettings();
      // Clean up the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
    if (searchParams.get('calendar_error')) {
      toast.error(`Failed to connect calendar: ${searchParams.get('calendar_error')}`);
      // Clean up the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [isBetaTester]);

  // Polling mechanism: Sync every 5 minutes when connected and sync enabled
  useEffect(() => {
    if (!isConnected || !settings.syncEnabled) {
      return;
    }

    const pollSync = async () => {
      try {
        await fetch('/api/google-calendar/poll-sync', {
          method: 'POST',
        });
      } catch (error) {
        console.error('Poll sync failed:', error);
      }
    };

    // Poll immediately on mount
    pollSync();

    // Set up interval for polling every 5 minutes
    const intervalId = setInterval(pollSync, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isConnected, settings.syncEnabled]);

  async function loadSettings() {
    try {
      const response = await fetch('/api/google-calendar/settings');
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.isConnected);
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error loading calendar settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/google-calendar/connect');
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        toast.error('Failed to initialize Google Calendar connection');
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      toast.error('Failed to connect to Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Google Calendar? This will remove all synced events from your calendar.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/google-calendar/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setIsConnected(false);
        toast.success('Google Calendar disconnected successfully');
      } else {
        toast.error('Failed to disconnect Google Calendar');
      }
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      toast.error('Failed to disconnect Google Calendar');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleManualSync() {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'both' }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Calendar sync completed successfully');
        await loadSettings();
      } else {
        toast.error('Failed to sync calendar');
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error('Failed to sync calendar');
    } finally {
      setIsSyncing(false);
    }
  }

  async function updateSetting(key: keyof CalendarSettings, value: boolean) {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      const response = await fetch('/api/google-calendar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (response.ok) {
        toast.success('Settings updated');
      } else {
        // Revert on error
        setSettings(settings);
        toast.error('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setSettings(settings);
      toast.error('Failed to update settings');
    }
  }

  async function handleCleanupDuplicates() {
    if (!confirm('This will remove duplicate calendar events. Continue?')) {
      return;
    }

    setIsCleaningUp(true);
    try {
      const response = await fetch('/api/google-calendar/cleanup-duplicates', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        await loadSettings();
      } else {
        toast.error('Failed to cleanup duplicates');
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      toast.error('Failed to cleanup duplicates');
    } finally {
      setIsCleaningUp(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar Sync
        </CardTitle>
        <CardDescription>
          Sync your tasks and timeline events with Google Calendar
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Coming Soon Overlay for Non-Beta Testers */}
        {!isBetaTester && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-lg flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  Coming Soon
                </Badge>
                <h3 className="text-xl font-semibold">Google Calendar Integration</h3>
                <p className="text-muted-foreground max-w-md">
                  We're currently verifying our app with Google to enable Calendar sync.
                  This feature will be available soon!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {isConnected ? 'Connected to Google Calendar' : 'Not connected'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? 'Your tasks are syncing with Google Calendar'
                  : 'Connect to enable automatic calendar sync'}
              </p>
            </div>
          </div>

          {isConnected ? (
            <Button variant="outline" onClick={handleDisconnect} disabled={isLoading}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect Google Calendar
            </Button>
          )}
        </div>

        {isConnected && (
          <>
            {/* Sync Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Last Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    {settings.lastSyncAt
                      ? new Date(settings.lastSyncAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualSync}
                    disabled={isSyncing || isCleaningUp}
                  >
                    {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCleanupDuplicates}
                    disabled={isSyncing || isCleaningUp}
                  >
                    {isCleaningUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Remove Duplicates
                  </Button>
                </div>
              </div>

              {settings.lastSyncError && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  <p className="font-medium">Last sync error:</p>
                  <p>{settings.lastSyncError}</p>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Sync Preferences</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Sync</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync tasks with Google Calendar
                    </p>
                  </div>
                  <Switch
                    checked={settings.syncEnabled}
                    onCheckedChange={(checked) => updateSetting('syncEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Include Full Details</Label>
                    <p className="text-sm text-muted-foreground">
                      Add property address, status, and task types to calendar events
                    </p>
                  </div>
                  <Switch
                    checked={settings.includeFullDetails}
                    onCheckedChange={(checked) => updateSetting('includeFullDetails', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Non-App Events</Label>
                    <p className="text-sm text-muted-foreground">
                      Display your other calendar events on the timeline (grayed out)
                    </p>
                  </div>
                  <Switch
                    checked={settings.syncNonAppEvents}
                    onCheckedChange={(checked) => updateSetting('syncNonAppEvents', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Exclude Financial Data</Label>
                    <p className="text-sm text-muted-foreground">
                      Don't include amounts in calendar events for privacy
                    </p>
                  </div>
                  <Switch
                    checked={settings.excludeFinancialData}
                    onCheckedChange={(checked) => updateSetting('excludeFinancialData', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CalendarCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">How it works:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Tasks are automatically synced to your "TC Helper" calendar</li>
                    <li>Changes in either place update the other in real-time</li>
                    <li>Events with property addresses automatically sync to the app</li>
                    <li>Archived tasks move to "TC Helper Archived Events" calendar</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
