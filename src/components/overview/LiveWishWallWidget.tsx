import React, { useState } from 'react';
import {
  MessageSquareHeart,
  Check,
  X,
  ArrowRight,
  Crown,
  Sparkles,
} from 'lucide-react';
import { Message } from '../../types';

interface LiveWishWallWidgetProps {
  messages: Message[];
  isLoading: boolean;
  error?: string | null;
  allowInlineModeration?: boolean;
  onModerateMessage?: (messageId: string, status: 'approved' | 'rejected') => Promise<void>;
  onOpenModerator: () => void;
}

export const LiveWishWallWidget: React.FC<LiveWishWallWidgetProps> = ({
  messages,
  isLoading,
  error,
  allowInlineModeration = true,
  onModerateMessage,
  onOpenModerator,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const recentMessages = messages.slice(0, 5);
  const pendingCount = messages.filter((m) => m.status === 'pending' || !m.status).length;

  const handleModerate = async (id: string, status: 'approved' | 'rejected') => {
    if (!onModerateMessage) return;
    setBusyId(id);
    setActionError(null);
    try {
      await onModerateMessage(id, status);
    } catch (err: any) {
      setActionError(err.message || 'Unable to update message status');
    } finally {
      setBusyId(null);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="rounded-2xl border border-[#E6E0D6] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(37,37,37,0.03)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEAE0]">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquareHeart className="w-4 h-4 text-[#9A7B38]" />
              <h2 className="font-serif text-lg font-normal text-[#23201C]">
                Live Wish Wall Feed
              </h2>
            </div>
            <p className="text-xs text-[#7A7368] mt-0.5">
              Real-time guest blessings & inline moderation
            </p>
          </div>

          {pendingCount > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 tabular-nums shrink-0">
              {pendingCount} pending
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FAF7F0] text-[#7A7368] border border-[#E6E0D6] tabular-nums shrink-0">
              {messages.length} total
            </span>
          )}
        </div>

        {actionError && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {actionError}
          </div>
        )}

        {/* Messages Feed */}
        {isLoading ? (
          <div className="mt-4 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-[#FAF7F0]" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-4 p-4 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        ) : recentMessages.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs text-[#7A7368]">
              No wedding wishes have been posted to this event yet.
            </p>
            <button
              type="button"
              onClick={onOpenModerator}
              className="text-xs font-medium text-[#8B7344] underline hover:text-[#23201C]"
            >
              Open Message Studio & QR Settings
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {recentMessages.map((msg) => {
              const status = msg.status || 'pending';
              const isApproved = status === 'approved';
              const isRejected = status === 'rejected';
              const isBusy = busyId === msg.id;

              return (
                <div
                  key={msg.id}
                  className="p-3.5 rounded-xl bg-[#FCFBF8] border border-[#EFEAE0] hover:border-[#DFD8CC] transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-xs font-semibold text-[#23201C] truncate">
                        {msg.name || 'Anonymous Guest'}
                      </span>
                      {(msg.classification === 'COUPLE_SELECTED' ||
                        msg.classification === 'SPECIAL_GUEST') && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF5EA] border border-[#E6D6B0] text-[10px] font-medium text-[#8B7344]">
                          <Crown className="w-2.5 h-2.5" />
                          <span>
                            {msg.classification === 'COUPLE_SELECTED' ? 'Featured' : 'VIP'}
                          </span>
                        </span>
                      )}
                      {msg.classification === 'AI_SUGGESTED' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF7F0] border border-[#E6E0D6] text-[10px] font-medium text-[#7A7368]">
                          <Sparkles className="w-2.5 h-2.5 text-[#C9A24D]" />
                          <span>Spotlight</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize border ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isRejected
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#4A443C] leading-relaxed line-clamp-2">
                    “{msg.message}”
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[10px] font-mono text-[#8A8276] tabular-nums">
                      {formatTimestamp(msg.timestamp)}
                    </span>

                    {allowInlineModeration && onModerateMessage && (
                      <div className="flex items-center gap-1.5">
                        {!isApproved && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleModerate(msg.id, 'approved')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-medium transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                        )}
                        {!isRejected && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleModerate(msg.id, 'rejected')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-[#7A7368] border border-[#E6E0D6] hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 text-[11px] font-medium transition-colors disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                            <span>Decline</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#EFEAE0] flex items-center justify-between">
        <span className="text-[11px] text-[#7A7368]">
          Showing latest {recentMessages.length} of {messages.length}
        </span>
        <button
          type="button"
          onClick={onOpenModerator}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#8B7344] hover:text-[#23201C] transition-colors"
        >
          <span>Open Full Message Studio</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default LiveWishWallWidget;
