"use client";

// src/components/comms/CommsCenter.tsx
// Main Communications Center component

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Mail,
  Send,
  FileEdit,
  Settings,
  Inbox,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  Loader2,
  Link2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EmailThread } from '@/lib/gmail/messages';
import {
  getCachedThreads,
  cacheThreads,
  getCacheMetadata,
  clearUserCache,
  getCachedDrafts,
  DraftEmail,
} from '@/lib/gmail/cache';
import GmailConnect from './GmailConnect';
import ThreadList from './ThreadList';
import ThreadView from './ThreadView';
import EmailComposer from './EmailComposer';
import CommsSettings from './CommsSettings';
import ResendEmailsView from './ResendEmailsView';

interface CommsCenterProps {
  userId: string;
  userEmail: string;
}

type NavSection = 'inbox' | 'sent' | 'drafts' | 'tc-helper' | 'settings';

export default function CommsCenter({ userId, userEmail }: CommsCenterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    hasAccess: boolean;
    email?: string;
    loading: boolean;
  }>({
    connected: false,
    hasAccess: true,
    loading: true,
  });

  const [activeSection, setActiveSection] = useState<NavSection>('inbox');
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState<'modal' | 'fullpage'>('modal');
  const [cacheInfo, setCacheInfo] = useState<{
    timestamp?: number;
    expiresAt?: number;
  } | null>(null);

  // Date range for fetching emails (default: last 7 days)
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  // Check for URL params (success/error after OAuth)
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'connected') {
      toast.success('Gmail connected successfully!');
      router.replace('/comms');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: 'Gmail connection was denied',
        no_code: 'Authorization code missing',
        user_not_found: 'User not found',
        state_mismatch: 'Security validation failed',
        missing_tokens: 'Failed to get access tokens',
        callback_failed: 'Connection failed, please try again',
      };
      toast.error(errorMessages[error] || 'An error occurred');
      router.replace('/comms');
    }
  }, [searchParams, router]);

  // Fetch Gmail status
  const fetchGmailStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/gmail/status');
      const data = await response.json();

      setGmailStatus({
        connected: data.connected,
        hasAccess: data.hasAccess,
        email: data.email,
        loading: false,
      });

      return data.connected;
    } catch (error) {
      console.error('Error fetching Gmail status:', error);
      setGmailStatus((prev) => ({ ...prev, loading: false }));
      return false;
    }
  }, []);

  // Fetch emails (with cache)
  const fetchEmails = useCallback(
    async (forceRefresh = false) => {
      if (!gmailStatus.connected) return;

      setIsLoading(true);

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getCachedThreads(userId, dateRange);
        if (cached) {
          setThreads(cached);
          const meta = getCacheMetadata(userId, dateRange);
          if (meta) setCacheInfo(meta);
          setIsLoading(false);
          return;
        }
      }

      try {
        setIsRefreshing(forceRefresh);
        const response = await fetch(
          `/api/gmail/messages?startDate=${dateRange.start}&endDate=${dateRange.end}&mode=threads`
        );

        if (!response.ok) {
          const error = await response.json();
          if (error.code === 'TOKEN_EXPIRED') {
            toast.error('Gmail session expired. Please reconnect.');
            setGmailStatus((prev) => ({ ...prev, connected: false }));
            return;
          }
          throw new Error(error.error || 'Failed to fetch emails');
        }

        const data = await response.json();
        setThreads(data.threads || []);

        // Cache the results
        cacheThreads(userId, data.threads || [], dateRange);
        const meta = getCacheMetadata(userId, dateRange);
        if (meta) setCacheInfo(meta);

        if (forceRefresh) {
          toast.success('Emails refreshed');
        }
      } catch (error) {
        console.error('Error fetching emails:', error);
        toast.error('Failed to fetch emails');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [gmailStatus.connected, userId, dateRange]
  );

  // Load drafts from cache
  const loadDrafts = useCallback(() => {
    const cachedDrafts = getCachedDrafts(userId);
    setDrafts(cachedDrafts);
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchGmailStatus().then((connected) => {
      if (connected) {
        fetchEmails();
      }
    });
    loadDrafts();
  }, [fetchGmailStatus, fetchEmails, loadDrafts]);

  // Filter threads based on active section
  const filteredThreads = threads.filter((thread) => {
    switch (activeSection) {
      case 'inbox':
        return thread.messages.some((m) => !m.isSentByUser);
      case 'sent':
        return thread.messages.some((m) => m.isSentByUser);
      case 'tc-helper':
        return thread.isTcHelper;
      default:
        return true;
    }
  });

  // Handle disconnect
  const handleDisconnect = async () => {
    if (
      !confirm(
        'Are you sure you want to disconnect Gmail?\n\nThis will:\n• Revoke TC Helper\'s access to your Gmail\n• Clear all cached emails from this browser\n• Remove your saved drafts\n\nYou can reconnect at any time.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch('/api/gmail/disconnect', { method: 'POST' });
      if (response.ok) {
        clearUserCache(userId);
        setGmailStatus({ connected: false, hasAccess: true, loading: false });
        setThreads([]);
        setDrafts([]);
        setSelectedThread(null);
        toast.success('Gmail disconnected');
      } else {
        toast.error('Failed to disconnect Gmail');
      }
    } catch (error) {
      toast.error('Failed to disconnect Gmail');
    }
  };

  // Handle new email composition
  const handleNewEmail = (mode: 'modal' | 'fullpage' = 'modal') => {
    setComposerMode(mode);
    setShowComposer(true);
  };

  // Nav items
  const navItems: { id: NavSection; label: string; icon: typeof Inbox; count?: number }[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'drafts', label: 'Drafts', icon: FileEdit, count: drafts.length },
    { id: 'tc-helper', label: 'TC Helper', icon: Link2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Loading state
  if (gmailStatus.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not connected state
  if (!gmailStatus.connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Comms Center</h1>
            <p className="text-muted-foreground">
              Send and receive emails directly from TC Helper
            </p>
          </div>

          <GmailConnect onConnected={fetchGmailStatus} />

          {/* Show Resend emails even when Gmail is not connected */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">TC Helper System Emails</h2>
            <ResendEmailsView userId={userId} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        {/* Compose button */}
        <div className="p-4">
          <Button onClick={() => handleNewEmail('modal')} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Compose
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setSelectedThread(null);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                activeSection === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    activeSection === item.id
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted-foreground/20'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Connected email */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="truncate">{gmailStatus.email}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold capitalize">{activeSection.replace('-', ' ')}</h2>
            {cacheInfo && activeSection !== 'settings' && activeSection !== 'drafts' && (
              <span className="text-xs text-muted-foreground">
                Last updated: {new Date(cacheInfo.timestamp!).toLocaleTimeString()}
              </span>
            )}
          </div>

          {activeSection !== 'settings' && activeSection !== 'drafts' && (
            <div className="flex items-center gap-2">
              {/* Date range selector */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="bg-transparent border rounded px-2 py-1 text-xs"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="bg-transparent border rounded px-2 py-1 text-xs"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchEmails(true)}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')}
                />
                Refresh
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {activeSection === 'settings' ? (
            <CommsSettings
              userId={userId}
              gmailEmail={gmailStatus.email}
              onDisconnect={handleDisconnect}
            />
          ) : activeSection === 'drafts' ? (
            <div className="flex-1 p-4">
              <DraftsList
                drafts={drafts}
                onSelect={(draft) => {
                  setComposerMode('fullpage');
                  setShowComposer(true);
                  // TODO: Load draft into composer
                }}
                onDelete={(draftId) => {
                  // TODO: Delete draft
                  loadDrafts();
                }}
              />
            </div>
          ) : (
            <>
              {/* Thread list */}
              <div
                className={cn(
                  'border-r overflow-y-auto',
                  selectedThread ? 'w-80' : 'flex-1'
                )}
              >
                {isLoading && !isRefreshing ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Mail className="h-12 w-12 mb-4" />
                    <p>No emails found</p>
                    <p className="text-sm">Try adjusting the date range</p>
                  </div>
                ) : (
                  <ThreadList
                    threads={filteredThreads}
                    selectedId={selectedThread?.id}
                    onSelect={setSelectedThread}
                  />
                )}
              </div>

              {/* Thread view */}
              {selectedThread && (
                <div className="flex-1 overflow-y-auto">
                  <ThreadView
                    thread={selectedThread}
                    userId={userId}
                    onReply={() => {
                      // TODO: Open composer with reply context
                      setShowComposer(true);
                    }}
                    onClose={() => setSelectedThread(null)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Email Composer Modal */}
      {showComposer && (
        <EmailComposer
          userId={userId}
          mode={composerMode}
          onClose={() => setShowComposer(false)}
          onSent={() => {
            setShowComposer(false);
            fetchEmails(true);
          }}
          onModeChange={setComposerMode}
        />
      )}
    </div>
  );
}

// Simple drafts list component
function DraftsList({
  drafts,
  onSelect,
  onDelete,
}: {
  drafts: DraftEmail[];
  onSelect: (draft: DraftEmail) => void;
  onDelete: (draftId: string) => void;
}) {
  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FileEdit className="h-12 w-12 mb-4" />
        <p>No drafts</p>
        <p className="text-sm">Drafts are saved locally in your browser</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <div
          key={draft.id}
          className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
          onClick={() => onSelect(draft)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {draft.subject || '(no subject)'}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                To: {draft.to.join(', ') || '(no recipients)'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last edited: {new Date(draft.updatedAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(draft.id);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
