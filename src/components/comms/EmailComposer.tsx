"use client";

// src/components/comms/EmailComposer.tsx
// Email composition modal/fullpage component

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Send,
  Paperclip,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { cacheDraft, deleteDraft, DraftEmail } from '@/lib/gmail/cache';
import { v4 as uuidv4 } from 'uuid';

interface EmailComposerProps {
  userId: string;
  mode: 'modal' | 'fullpage';
  onClose: () => void;
  onSent: () => void;
  onModeChange: (mode: 'modal' | 'fullpage') => void;
  replyTo?: {
    threadId: string;
    to: string[];
    subject: string;
    inReplyTo?: string;
    references?: string;
  };
  draft?: DraftEmail;
}

export default function EmailComposer({
  userId,
  mode,
  onClose,
  onSent,
  onModeChange,
  replyTo,
  draft,
}: EmailComposerProps) {
  const [draftId] = useState(draft?.id || uuidv4());
  const [to, setTo] = useState<string>(draft?.to.join(', ') || replyTo?.to.join(', ') || '');
  const [cc, setCc] = useState<string>(draft?.cc.join(', ') || '');
  const [bcc, setBcc] = useState<string>(draft?.bcc.join(', ') || '');
  const [showCcBcc, setShowCcBcc] = useState(!!cc || !!bcc);
  const [subject, setSubject] = useState(
    draft?.subject || (replyTo?.subject ? `Re: ${replyTo.subject}` : '')
  );
  const [body, setBody] = useState(draft?.bodyHtml || draft?.bodyText || '');
  const [isSending, setIsSending] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save draft periodically
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (to || subject || body) {
        saveDraft();
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveInterval);
  }, [to, cc, bcc, subject, body]);

  const saveDraft = () => {
    const draftData: DraftEmail = {
      id: draftId,
      to: to.split(',').map((e) => e.trim()).filter(Boolean),
      cc: cc.split(',').map((e) => e.trim()).filter(Boolean),
      bcc: bcc.split(',').map((e) => e.trim()).filter(Boolean),
      subject,
      bodyText: body,
      bodyHtml: body,
      threadId: replyTo?.threadId,
      createdAt: draft?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    cacheDraft(userId, draftData);
  };

  const handleSend = async () => {
    // Validate
    const toAddresses = to.split(',').map((e) => e.trim()).filter(Boolean);
    if (toAddresses.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    if (!subject.trim()) {
      const confirmed = confirm('Send without a subject?');
      if (!confirmed) return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toAddresses,
          cc: cc.split(',').map((e) => e.trim()).filter(Boolean),
          bcc: bcc.split(',').map((e) => e.trim()).filter(Boolean),
          subject: subject || '(no subject)',
          bodyText: body,
          bodyHtml: `<div style="font-family: sans-serif;">${body.replace(/\n/g, '<br>')}</div>`,
          threadId: replyTo?.threadId,
          inReplyTo: replyTo?.inReplyTo,
          references: replyTo?.references,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      // Delete draft on successful send
      deleteDraft(userId, draftId);

      toast.success('Email sent!');
      onSent();
    } catch (error) {
      console.error('Send error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleDiscard = () => {
    if (to || subject || body) {
      const confirmed = confirm('Discard this draft?');
      if (!confirmed) return;
    }
    deleteDraft(userId, draftId);
    onClose();
  };

  // Modal mode (Gmail-style bottom-right composer)
  if (mode === 'modal') {
    return (
      <div
        className={cn(
          'fixed bottom-0 right-4 z-50 w-[500px] bg-background border rounded-t-lg shadow-2xl flex flex-col',
          isMinimized ? 'h-12' : 'h-[500px]'
        )}
      >
        {/* Header */}
        <div
          className="h-12 px-4 flex items-center justify-between bg-muted/50 rounded-t-lg cursor-pointer"
          onClick={() => isMinimized && setIsMinimized(false)}
        >
          <span className="font-medium text-sm truncate">
            {subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onModeChange('fullpage');
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                saveDraft();
                onClose();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Recipients */}
            <div className="px-4 py-2 space-y-2 border-b">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground w-12">To</label>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                {!showCcBcc && (
                  <button
                    onClick={() => setShowCcBcc(true)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cc/Bcc
                  </button>
                )}
              </div>

              {showCcBcc && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground w-12">Cc</label>
                    <input
                      type="text"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground w-12">Bcc</label>
                    <input
                      type="text"
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground w-12">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 overflow-hidden">
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className="w-full h-full resize-none bg-transparent outline-none text-sm"
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button onClick={handleSend} disabled={isSending}>
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDiscard}
                disabled={isSending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fullpage mode
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 border-b flex items-center justify-between">
        <h2 className="font-semibold">New Message</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onModeChange('modal')}
          >
            <Minimize2 className="h-4 w-4 mr-2" />
            Minimize
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              saveDraft();
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6 overflow-hidden">
        {/* Recipients */}
        <div className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium w-16">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 bg-transparent border rounded-md px-3 py-2 text-sm"
            />
            {!showCcBcc && (
              <button
                onClick={() => setShowCcBcc(true)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Add Cc/Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium w-16">Cc</label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="flex-1 bg-transparent border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium w-16">Bcc</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  className="flex-1 bg-transparent border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium w-16">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent border rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 py-4 overflow-hidden">
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="w-full h-full resize-none bg-transparent border rounded-md p-4 text-sm"
          />
        </div>

        {/* Footer */}
        <div className="pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="lg" onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
            <Button variant="outline" onClick={saveDraft}>
              Save Draft
            </Button>
          </div>
          <Button variant="ghost" onClick={handleDiscard} disabled={isSending}>
            <Trash2 className="h-4 w-4 mr-2" />
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
