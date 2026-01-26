"use client";

// src/components/comms/ThreadList.tsx
// Email thread list component

import { EmailThread } from '@/lib/gmail/messages';
import { cn } from '@/lib/utils';
import { Paperclip, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ThreadListProps {
  threads: EmailThread[];
  selectedId?: string;
  onSelect: (thread: EmailThread) => void;
}

export default function ThreadList({ threads, selectedId, onSelect }: ThreadListProps) {
  return (
    <div className="divide-y">
      {threads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isSelected={selectedId === thread.id}
          onClick={() => onSelect(thread)}
        />
      ))}
    </div>
  );
}

interface ThreadListItemProps {
  thread: EmailThread;
  isSelected: boolean;
  onClick: () => void;
}

function ThreadListItem({ thread, isSelected, onClick }: ThreadListItemProps) {
  // Get the display name from the first non-user participant
  const displayParticipants = thread.participants
    .filter((p) => !p.includes('me'))
    .slice(0, 3)
    .map((p) => {
      // Extract name from "Name <email>" format
      const match = p.match(/^(.+?)\s*<.*>$/);
      return match ? match[1].trim() : p.split('@')[0];
    });

  const participantDisplay =
    displayParticipants.length > 0
      ? displayParticipants.join(', ')
      : thread.participants[0]?.split('@')[0] || 'Unknown';

  // Format time
  const timeDisplay = formatDistanceToNow(new Date(thread.lastMessageTimestamp), {
    addSuffix: false,
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
        isSelected && 'bg-muted',
        !thread.isRead && 'bg-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator */}
        <div className="flex-shrink-0 mt-2">
          {!thread.isRead && (
            <div className="w-2 h-2 rounded-full bg-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={cn(
                'font-medium truncate',
                !thread.isRead && 'font-semibold'
              )}
            >
              {participantDisplay}
              {thread.messageCount > 1 && (
                <span className="text-muted-foreground font-normal ml-1">
                  ({thread.messageCount})
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {timeDisplay}
            </span>
          </div>

          {/* Subject */}
          <p
            className={cn(
              'text-sm truncate',
              !thread.isRead ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {thread.subject || '(no subject)'}
          </p>

          {/* Snippet */}
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {thread.snippet}
          </p>

          {/* Indicators */}
          <div className="flex items-center gap-2 mt-1">
            {thread.hasAttachments && (
              <Paperclip className="h-3 w-3 text-muted-foreground" />
            )}
            {thread.isTcHelper && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Tag className="h-3 w-3" />
                TC Helper
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
