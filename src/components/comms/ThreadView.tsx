"use client";

// src/components/comms/ThreadView.tsx
// Email thread detail view component

import { useState } from 'react';
import { EmailThread, EmailMessage, EmailAttachment } from '@/lib/gmail/messages';
import { cn } from '@/lib/utils';
import {
  X,
  Reply,
  Forward,
  Paperclip,
  Download,
  ChevronDown,
  ChevronUp,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ThreadViewProps {
  thread: EmailThread;
  userId: string;
  onReply: () => void;
  onClose: () => void;
}

export default function ThreadView({ thread, userId, onReply, onClose }: ThreadViewProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set([thread.messages[thread.messages.length - 1]?.id].filter(Boolean))
  );

  const toggleMessage = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedMessages(new Set(thread.messages.map((m) => m.id)));
  };

  const collapseAll = () => {
    // Keep the last message expanded
    setExpandedMessages(
      new Set([thread.messages[thread.messages.length - 1]?.id].filter(Boolean))
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold mb-1">
              {thread.subject || '(no subject)'}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{thread.messageCount} messages</span>
              {thread.isTcHelper && (
                <span className="flex items-center gap-1 text-primary">
                  <Tag className="h-3 w-3" />
                  TC Helper
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {thread.messages.length > 1 && (
          <div className="flex items-center gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              <ChevronDown className="h-4 w-4 mr-1" />
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              <ChevronUp className="h-4 w-4 mr-1" />
              Collapse
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isExpanded={expandedMessages.has(message.id)}
            isLast={index === thread.messages.length - 1}
            onToggle={() => toggleMessage(message.id)}
            userId={userId}
          />
        ))}
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: EmailMessage;
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  userId: string;
}

function MessageItem({ message, isExpanded, isLast, onToggle, userId }: MessageItemProps) {
  // Parse sender info
  const senderMatch = message.from.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = senderMatch ? senderMatch[1].trim() : message.from.split('@')[0];
  const senderEmail = senderMatch ? senderMatch[2] : message.from;

  const formattedDate = format(new Date(message.timestamp), 'MMM d, yyyy h:mm a');

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden',
        message.isSentByUser && 'border-primary/30 bg-primary/5'
      )}
    >
      {/* Header (always visible) */}
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                message.isSentByUser ? 'bg-primary' : 'bg-muted-foreground'
              )}
            >
              {senderName[0]?.toUpperCase() || '?'}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {message.isSentByUser ? 'Me' : senderName}
                </span>
                {message.isTcHelper && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    TC Helper
                  </span>
                )}
              </div>
              {!isExpanded && (
                <p className="text-sm text-muted-foreground truncate max-w-md">
                  {message.snippet}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {message.hasAttachments && <Paperclip className="h-4 w-4" />}
            <span>{formattedDate}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          {/* Recipients */}
          <div className="px-4 py-2 bg-muted/30 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">From:</span>
              <span>{message.from}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">To:</span>
              <span>{message.to.join(', ')}</span>
            </div>
            {message.cc.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Cc:</span>
                <span>{message.cc.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-4">
            {message.bodyHtml ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {message.bodyText}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className="border-t px-4 py-3">
              <h4 className="text-sm font-medium mb-2">
                Attachments ({message.attachments.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <AttachmentItem
                    key={attachment.id}
                    attachment={attachment}
                    messageId={message.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AttachmentItemProps {
  attachment: EmailAttachment;
  messageId: string;
}

function AttachmentItem({ attachment, messageId }: AttachmentItemProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/gmail/attachments?messageId=${messageId}&attachmentId=${attachment.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to download attachment');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download attachment');
    } finally {
      setIsDownloading(false);
    }
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
    >
      <Paperclip className="h-4 w-4 text-muted-foreground" />
      <div className="text-left">
        <p className="text-sm font-medium truncate max-w-[200px]">
          {attachment.filename}
        </p>
        <p className="text-xs text-muted-foreground">{formatSize(attachment.size)}</p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
