"use client";

// src/components/comms/GmailConnect.tsx
// Gmail connection prompt component

import { useState } from 'react';
import { Mail, Shield, Eye, Tag, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GmailConnectProps {
  onConnected?: () => void;
}

export default function GmailConnect({ onConnected }: GmailConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Redirect to OAuth flow
    window.location.href = '/api/gmail/connect';
  };

  const features = [
    {
      icon: Eye,
      title: 'Read your emails',
      description: 'View your inbox directly in TC Helper',
    },
    {
      icon: Mail,
      title: 'Send emails',
      description: 'Compose and send emails without leaving TC Helper',
    },
    {
      icon: Tag,
      title: 'Organize with labels',
      description: 'All emails sent via TC Helper are automatically labeled',
    },
  ];

  const permissions = [
    'Read your email messages',
    'Send emails on your behalf',
    'Create and manage labels',
    'View your email address',
  ];

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Left side - Features */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Connect Gmail</h2>
          <p className="text-muted-foreground">
            Connect your Gmail account to send and receive emails directly from TC Helper.
          </p>
        </div>

        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full md:w-auto gap-2"
        >
          <Mail className="h-5 w-5" />
          {isConnecting ? 'Connecting...' : 'Connect Gmail'}
        </Button>
      </div>

      {/* Right side - Privacy info */}
      <div className="bg-muted/50 rounded-lg p-6 border">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold">Privacy & Security</h3>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium mb-2">What we access:</p>
            <ul className="space-y-2">
              {permissions.map((permission) => (
                <li key={permission} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  {permission}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t pt-4">
            <p className="font-medium mb-2">How we protect your data:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>No email storage:</strong> We don&apos;t store your emails on our servers.
                  Emails are cached locally in your browser for up to 24 hours.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Secure connection:</strong> All communication with Gmail uses
                  OAuth 2.0 and encrypted connections.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Revoke anytime:</strong> You can disconnect Gmail and revoke
                  access at any time from Settings.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
