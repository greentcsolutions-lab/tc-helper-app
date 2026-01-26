"use client";

// src/components/comms/CommsSettings.tsx
// Comms Center settings component

import { useState, useEffect } from 'react';
import {
  Mail,
  Shield,
  FileSignature,
  Unlink,
  Loader2,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { clearUserCache } from '@/lib/gmail/cache';

interface CommsSettingsProps {
  userId: string;
  gmailEmail?: string;
  onDisconnect: () => void;
}

export default function CommsSettings({
  userId,
  gmailEmail,
  onDisconnect,
}: CommsSettingsProps) {
  const [useCustomSignature, setUseCustomSignature] = useState(false);
  const [customSignature, setCustomSignature] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/gmail/status');
        const data = await response.json();

        if (data.signature) {
          setUseCustomSignature(data.signature.useCustom);
          setCustomSignature(data.signature.content || '');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSaveSignature = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/gmail/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCustomSignature,
          customSignature,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Signature settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = () => {
    clearUserCache(userId);
    toast.success('Email cache cleared');
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-8">
        {/* Gmail Connection */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail Connection
          </h3>

          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{gmailEmail}</p>
                <p className="text-sm text-muted-foreground">Connected to Gmail</p>
              </div>
              <Button variant="outline" onClick={onDisconnect}>
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        </section>

        {/* Email Signature */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Email Signature
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useCustomSignature"
                checked={useCustomSignature}
                onChange={(e) => setUseCustomSignature(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="useCustomSignature" className="text-sm">
                Use custom signature for emails sent from TC Helper
              </label>
            </div>

            {useCustomSignature && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Signature (HTML supported)
                </label>
                <textarea
                  value={customSignature}
                  onChange={(e) => setCustomSignature(e.target.value)}
                  placeholder="<p>Best regards,<br>Your Name</p>"
                  rows={6}
                  className="w-full border rounded-md p-3 text-sm font-mono bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  If disabled, emails will use your Gmail default signature (if configured).
                </p>
              </div>
            )}

            <Button onClick={handleSaveSignature} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Signature Settings
            </Button>
          </div>
        </section>

        {/* Privacy & Cache */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Cache
          </h3>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 border">
              <h4 className="font-medium mb-2">Email Cache</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Emails are cached locally in your browser for up to 24 hours to improve
                performance. This data is not stored on TC Helper servers.
              </p>
              <Button variant="outline" size="sm" onClick={handleClearCache}>
                Clear Email Cache
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border">
              <h4 className="font-medium mb-2">Data We Access</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Read your email messages (to display in Comms Center)</li>
                <li>• Send emails on your behalf (when you compose and send)</li>
                <li>• Create and manage labels (TC Helper label)</li>
                <li>• Your email address (for identification)</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border">
              <h4 className="font-medium mb-2">Sent Email Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Emails sent through TC Helper are logged for your records. This includes
                the recipient, subject, and timestamp. Email content is not stored on
                our servers.
              </p>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </h3>

          <div className="border border-destructive/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Disconnect Gmail</h4>
            <p className="text-sm text-muted-foreground mb-3">
              This will revoke TC Helper&apos;s access to your Gmail account, clear all
              cached emails, and delete any saved drafts. You can reconnect at any time.
            </p>
            <Button variant="destructive" onClick={onDisconnect}>
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect Gmail
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
