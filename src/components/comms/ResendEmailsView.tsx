"use client";

// src/components/comms/ResendEmailsView.tsx
// Shows TC Helper system emails (from Resend/Communications table)

import { useState, useEffect } from 'react';
import { Mail, Inbox, Send, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Communication {
  id: string;
  direction: string;
  type: string;
  from: string;
  to: string;
  subject: string | null;
  bodyText: string | null;
  status: string;
  createdAt: string;
}

interface ResendEmailsViewProps {
  userId: string;
}

export default function ResendEmailsView({ userId }: ResendEmailsViewProps) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Communication | null>(null);

  useEffect(() => {
    async function fetchCommunications() {
      try {
        const response = await fetch('/api/communications');
        if (response.ok) {
          const data = await response.json();
          setCommunications(data.communications || []);
        }
      } catch (error) {
        console.error('Error fetching communications:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCommunications();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (communications.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg p-8 text-center">
        <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-medium mb-2">No system emails yet</h3>
        <p className="text-sm text-muted-foreground">
          Emails from TC Helper (extraction results, notifications) will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="divide-y max-h-[400px] overflow-y-auto">
        {communications.map((comm) => (
          <button
            key={comm.id}
            onClick={() => setSelectedEmail(selectedEmail?.id === comm.id ? null : comm)}
            className={cn(
              'w-full text-left p-4 hover:bg-muted/50 transition-colors',
              selectedEmail?.id === comm.id && 'bg-muted'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Direction icon */}
              <div
                className={cn(
                  'p-2 rounded-full',
                  comm.direction === 'inbound'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-green-100 text-green-600'
                )}
              >
                {comm.direction === 'inbound' ? (
                  <Inbox className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium truncate">
                    {comm.direction === 'inbound' ? comm.from : comm.to}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(comm.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <p className="text-sm truncate">{comm.subject || '(no subject)'}</p>

                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={comm.status} />
                  <span className="text-xs text-muted-foreground">
                    {comm.direction === 'inbound' ? 'Received' : 'Sent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            {selectedEmail?.id === comm.id && comm.bodyText && (
              <div className="mt-4 p-4 bg-background rounded border text-sm">
                <pre className="whitespace-pre-wrap font-sans">{comm.bodyText}</pre>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle; className: string; label: string }> = {
    completed: {
      icon: CheckCircle,
      className: 'text-green-600 bg-green-100',
      label: 'Completed',
    },
    pending: {
      icon: Clock,
      className: 'text-yellow-600 bg-yellow-100',
      label: 'Pending',
    },
    processing: {
      icon: Loader2,
      className: 'text-blue-600 bg-blue-100',
      label: 'Processing',
    },
    failed: {
      icon: AlertCircle,
      className: 'text-red-600 bg-red-100',
      label: 'Failed',
    },
    rejected: {
      icon: AlertCircle,
      className: 'text-orange-600 bg-orange-100',
      label: 'Rejected',
    },
  };

  const { icon: Icon, className, label } = config[status] || config.pending;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
