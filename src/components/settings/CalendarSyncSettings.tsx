// src/components/settings/CalendarSyncSettings.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, RefreshCw, Loader2, CalendarCheck, Lock } from "lucide-react";
import { toast } from "sonner";

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
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings>({
    syncEnabled: true,
    includeFullDetails: true,
    syncNonAppEvents: true,
    excludeFinancialData: true,
    lastSyncAt: null,
    lastSyncError: null,
    webhookExpiration: null,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

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
      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-lg">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <Badge variant="secondary" className="text-base px-4 py-1.5">
              Coming Soon
            </Badge>
          </div>
          <div className="max-w-md px-4">
            <h3 className="text-lg font-semibold mb-2">Google Calendar Integration</h3>
            <p className="text-sm text-muted-foreground">
              We're currently verifying our app with Google to enable Calendar sync.
              This feature will be available soon!
            </p>
          </div>
        </div>
      </div>

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Now
                </Button>
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
