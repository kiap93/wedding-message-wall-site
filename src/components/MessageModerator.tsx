import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, X, Clock, AlertCircle } from 'lucide-react';
import { Message, fetchMessages, updateMessageStatus } from '../lib/api';
import Tabs from '../design-system/components/Tabs';
import Button from '../design-system/components/Button';
import EmptyState from '../design-system/components/EmptyState';

interface MessageModeratorProps {
  projectId: string;
}

export default function MessageModerator({ projectId }: MessageModeratorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadMessages();
  }, [projectId, filter]);

  async function loadMessages() {
    setIsLoading(true);
    const allMessages = await fetchMessages(projectId, true);
    setMessages(allMessages.filter(m => (m.status || 'pending') === filter));
    setIsLoading(false);
  }

  const handleStatusUpdate = async (messageId: string, status: 'approved' | 'rejected') => {
    try {
      await updateMessageStatus(messageId, status);
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (err) {
      alert('Failed to update message status');
    }
  };

  const tabs = [
    { id: 'pending', label: 'Pending Review' },
    { id: 'approved', label: 'Approved Broadcast' },
    { id: 'rejected', label: 'Declined' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#252525]">Reception Screen Moderation</h3>
          <p className="text-xs text-[#777777]">Review guest wishes and photo memories before broadcasting to venue displays</p>
        </div>

        <Tabs
          variant="segmented"
          items={tabs}
          activeId={filter}
          onChange={(id) => setFilter(id as any)}
        />
      </div>

      <div className="bg-white rounded-lg border border-[#E8E8E5] shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#777777]">
            <div className="w-5 h-5 border-2 border-[#252525] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading message queue...</span>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-5 h-5" />}
            title={`No ${filter} messages`}
            description={
              filter === 'pending'
                ? 'All guest messages have been reviewed and moderated.'
                : `No messages currently marked as ${filter}.`
            }
          />
        ) : (
          <div className="divide-y divide-[#EFEFEA]">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF9F7]/50 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[#252525]">{msg.name}</span>
                    <span className="text-[#B0ADA8]">·</span>
                    <span className="text-[#777777] font-mono tabular-nums text-[11px]">
                      {new Date(msg.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#555555] leading-relaxed">
                    "{msg.message}"
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {filter !== 'approved' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStatusUpdate(msg.id, 'approved')}
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                    >
                      Approve
                    </Button>
                  )}
                  {filter !== 'rejected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate(msg.id, 'rejected')}
                      leftIcon={<X className="w-3.5 h-3.5" />}
                    >
                      Decline
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
