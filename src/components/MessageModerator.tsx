import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, 
  Check, 
  X, 
  Clock, 
  AlertCircle, 
  Star, 
  Pin, 
  Sparkles, 
  Sliders, 
  Eye, 
  Crown, 
  RefreshCw, 
  X as CloseIcon,
  CheckCircle2,
  Info,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Shuffle,
  Pause,
  Play,
} from 'lucide-react';
import { 
  Message, 
  MessageClassification, 
  MessageDisplayConfig, 
  DEFAULT_MESSAGE_DISPLAY_CONFIG, 
  fetchMessages, 
  updateMessageStatus, 
  updateMessageHighlight, 
  analyzeMessagesWithAI, 
  updateMessageDisplayConfig 
} from '../lib/api';
import {
  ALL_DANMAKU_DIRECTIONS,
  DANMAKU_DENSITY_PRESETS,
  DANMAKU_DIRECTION_META,
  DanmakuDensity,
  DanmakuDirection,
  DanmakuDirectionMode,
  DanmakuFontSize,
  DanmakuSpecialStyle,
  AnimationIntensity,
  directionToSlug,
  resolveDisplayConfig,
} from '../types';
import Tabs from '../design-system/components/Tabs';
import Button from '../design-system/components/Button';
import EmptyState from '../design-system/components/EmptyState';
import { DanmakuPillCard, DanmakuStage } from './display/DanmakuStage';
import { resolveEventTheme } from '../lib/eventTheme';
import { getSupabase } from '../lib/supabase';

/**
 * Isolated simulation-only sample wishes for the Display Settings live preview.
 * Strictly local in memory — never sent to API endpoints or published to the real event room.
 */
const SIMULATED_PREVIEW_MESSAGES: Message[] = [
  {
    id: 'sim-preview-1',
    name: 'Elena & Mark',
    message: 'Wishing you both a lifetime of sunlit mornings and joyous toasts!',
    timestamp: 1700000001000,
    status: 'approved',
    classification: 'NORMAL',
  },
  {
    id: 'sim-preview-2',
    name: 'Aunt Evelyn',
    message: 'So proud to witness your forever begin today.',
    timestamp: 1700000002000,
    status: 'approved',
    classification: 'SPECIAL_GUEST',
    guest_category: 'Family',
    wish_category: 'family',
  },
  {
    id: 'sim-preview-3',
    name: 'Julian Vance',
    message: 'Best reception celebration of the year — cheers to the newlyweds!',
    timestamp: 1700000003000,
    status: 'approved',
    classification: 'NORMAL',
    wish_category: 'funny',
  },
  {
    id: 'sim-preview-4',
    name: 'Clara Chen',
    message: 'May every chapter together shine brighter than tonight.',
    timestamp: 1700000004000,
    status: 'approved',
    classification: 'AI_SUGGESTED',
    wish_category: 'heartfelt',
  },
  {
    id: 'sim-preview-5',
    name: 'Liam & Hannah',
    message: 'To endless laughter, love, and dancing!',
    timestamp: 1700000005000,
    status: 'approved',
    classification: 'NORMAL',
  },
  {
    id: 'sim-preview-6',
    name: 'Dr. & Mrs. Patel',
    message: 'Warmest blessings for a harmonious and radiant marriage.',
    timestamp: 1700000006000,
    status: 'approved',
    classification: 'NORMAL',
  },
];

interface MessageModeratorProps {
  projectId: string;
  themeId?: string;
  initialDisplayConfig?: MessageDisplayConfig;
  onConfigSaved?: (config: MessageDisplayConfig) => void;
}

export default function MessageModerator({ 
  projectId, 
  themeId = 'minimal_luxury',
  initialDisplayConfig,
  onConfigSaved
}: MessageModeratorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // AI Highlights state
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ id: string; classification: MessageClassification; reason: string }>>([]);
  const [showAiModal, setShowAiModal] = useState(false);

  // Display Preview modal state
  const [previewMessage, setPreviewMessage] = useState<Message | null>(null);

  // Display Configuration modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [displayConfig, setDisplayConfig] = useState<MessageDisplayConfig>(() =>
    resolveDisplayConfig(initialDisplayConfig || DEFAULT_MESSAGE_DISPLAY_CONFIG)
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [isPreviewPaused, setIsPreviewPaused] = useState(false);

  const resolvedPreviewConfig = useMemo(
    () => resolveDisplayConfig(displayConfig),
    [displayConfig]
  );

  const updateDisplayConfigSynced = (patch: Partial<MessageDisplayConfig>) => {
    setDisplayConfig((prev) => {
      const merged = resolveDisplayConfig({
        ...prev,
        ...patch,
      });
      return merged;
    });
  };

  // Sync displayConfig if parent event prop updates
  useEffect(() => {
    if (initialDisplayConfig) {
      setDisplayConfig(resolveDisplayConfig(initialDisplayConfig));
    }
  }, [initialDisplayConfig]);

  // Resolved aesthetic theme for realistic wall preview
  const resolvedTheme = resolveEventTheme(themeId);

  useEffect(() => {
    loadMessages();
  }, [projectId, filter]);

  // Realtime subscription so classification and moderation sync live without refresh
  useEffect(() => {
    if (!projectId) return;

    let channel: any = null;
    try {
      const supabase = getSupabase();
      channel = supabase
        .channel(`messages-moderation-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `project_id=eq.${projectId}`
          },
          (payload) => {
            const updated = payload.new as Message;
            if (!updated) return;
            setMessages((prev) => {
              const exists = prev.some(m => m.id === updated.id);
              if (exists) {
                return prev.map(m => m.id === updated.id ? { ...m, ...updated } : m);
              }
              return [updated, ...prev];
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription not available in moderation panel');
    }

    return () => {
      if (channel) {
        const supabase = getSupabase();
        supabase.removeChannel(channel);
      }
    };
  }, [projectId]);

  async function loadMessages() {
    setIsLoading(true);
    const allMessages = await fetchMessages(projectId, true);
    setMessages(allMessages.filter(m => (m.status || 'pending') === filter));
    setIsLoading(false);
  }

  const handleStatusUpdate = async (messageId: string, status: 'approved' | 'rejected') => {
    setActionError(null);
    try {
      await updateMessageStatus(messageId, status);
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update message status');
    }
  };

  const handleToggleFeatured = async (msg: Message) => {
    setActionError(null);
    const nextFeatured = !msg.is_featured;
    const nextClassification: MessageClassification = nextFeatured 
      ? (msg.classification === 'NORMAL' || !msg.classification ? 'COUPLE_SELECTED' : msg.classification)
      : (msg.classification === 'COUPLE_SELECTED' ? 'NORMAL' : (msg.classification || 'NORMAL'));

    try {
      await updateMessageHighlight(msg.id, {
        is_featured: nextFeatured,
        classification: nextClassification
      });
      setMessages(messages.map(m => m.id === msg.id ? { 
        ...m, 
        is_featured: nextFeatured, 
        classification: nextClassification 
      } : m));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update featured status');
    }
  };

  const handleTogglePinned = async (msg: Message) => {
    setActionError(null);
    const nextPinned = !msg.is_pinned;
    try {
      await updateMessageHighlight(msg.id, { is_pinned: nextPinned });
      setMessages(messages.map(m => m.id === msg.id ? { ...m, is_pinned: nextPinned } : m));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update pinned status');
    }
  };

  const handleChangeClassification = async (msg: Message, classification: MessageClassification) => {
    setActionError(null);
    const isFeatured = classification === 'COUPLE_SELECTED' || classification === 'SPECIAL_GUEST' || msg.is_featured;
    try {
      await updateMessageHighlight(msg.id, {
        classification,
        is_featured: isFeatured
      });
      setMessages(messages.map(m => m.id === msg.id ? { 
        ...m, 
        classification, 
        is_featured: isFeatured 
      } : m));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to change message classification');
    }
  };

  const handleRunAiAnalysis = async () => {
    setActionError(null);
    setIsAnalyzingAI(true);
    try {
      const res = await analyzeMessagesWithAI(projectId);
      setAiSuggestions(res.suggestions || []);
      setShowAiModal(true);
    } catch (err: any) {
      setActionError('AI highlight analysis error: ' + (err.message || 'Please ensure messages are approved.'));
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleApplyAiSuggestion = async (suggestion: { id: string; classification: MessageClassification; reason: string }, targetClass: MessageClassification = 'AI_SUGGESTED') => {
    setActionError(null);
    try {
      await updateMessageHighlight(suggestion.id, {
        classification: targetClass,
        ai_highlight_reason: suggestion.reason,
        is_featured: targetClass === 'COUPLE_SELECTED'
      });
      setMessages(messages.map(m => m.id === suggestion.id ? { 
        ...m, 
        classification: targetClass,
        ai_highlight_reason: suggestion.reason,
        is_featured: targetClass === 'COUPLE_SELECTED' ? true : m.is_featured
      } : m));
      setAiSuggestions(aiSuggestions.filter(s => s.id !== suggestion.id));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to apply recommendation');
    }
  };

  const handleSaveDisplayConfig = async () => {
    setActionError(null);
    setIsSavingConfig(true);
    try {
      const normalized = resolveDisplayConfig(displayConfig);
      await updateMessageDisplayConfig(projectId, normalized);
      setDisplayConfig(normalized);
      onConfigSaved?.(normalized);
      setConfigSuccess(true);
      setTimeout(() => {
        setConfigSuccess(false);
        setShowConfigModal(false);
      }, 900);
    } catch (err: any) {
      setActionError('Failed to save display config: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const tabs = [
    { id: 'approved', label: 'Approved Broadcast' },
    { id: 'pending', label: 'Pending Review' },
    { id: 'rejected', label: 'Declined' },
  ];

  // Filtering messages by classification
  const filteredMessages = messages.filter(m => {
    if (classificationFilter === 'all') return true;
    if (classificationFilter === 'featured') return m.is_featured;
    if (classificationFilter === 'pinned') return m.is_pinned;
    return (m.classification || 'NORMAL') === classificationFilter;
  });

  return (
    <div className="space-y-5">
      {/* Header and Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#252525]">Reception Screen Moderation & Highlights</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              Priority System
            </span>
          </div>
          <p className="text-xs text-[#777777] mt-0.5">
            Identify and prioritize meaningful wedding memories for dedicated spotlight presentation
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* AI Smart Highlights Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAiAnalysis}
            isLoading={isAnalyzingAI}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-600" />}
            className="!border-amber-300 hover:!bg-amber-50/60 !text-amber-900"
          >
            AI Highlight Curator
          </Button>

          {/* Display & Danmaku Settings Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            leftIcon={<Sliders className="w-3.5 h-3.5 text-[#8B806F]" />}
          >
            Danmaku &amp; Display Settings
          </Button>

          <Tabs
            variant="segmented"
            items={tabs}
            activeId={filter}
            onChange={(id) => setFilter(id as any)}
          />
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {actionError}
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-700 hover:text-red-900 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Classification Filters Bar (when viewing approved messages) */}
      {filter === 'approved' && (
        <div className="flex items-center justify-between gap-3 bg-[#FAF9F7] p-2.5 rounded-lg border border-[#E8E8E5] text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[#777777] text-[11px] font-medium mr-1 uppercase font-mono">Filter:</span>
            {[
              { id: 'all', label: 'All Messages' },
              { id: 'COUPLE_SELECTED', label: "⭐ Couple's Spotlight" },
              { id: 'SPECIAL_GUEST', label: '👑 Special Guest' },
              { id: 'AI_SUGGESTED', label: '✨ AI Suggested' },
              { id: 'pinned', label: '📌 Pinned Only' },
              { id: 'NORMAL', label: 'Standard Rotation' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setClassificationFilter(f.id)}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                  classificationFilter === f.id
                    ? 'bg-[#252525] text-white font-medium shadow-xs'
                    : 'bg-white border border-[#E8E8E5] text-[#555555] hover:bg-[#FAF9F7]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-[#777777] font-mono shrink-0 hidden md:block">
            {filteredMessages.length} {filteredMessages.length === 1 ? 'Message' : 'Messages'}
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="bg-white rounded-xl border border-[#E8E8E5] shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#777777]">
            <div className="w-5 h-5 border-2 border-[#252525] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading message queue...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-5 h-5" />}
            title={`No ${filter} messages found`}
            description={
              classificationFilter !== 'all'
                ? `No messages currently match the "${classificationFilter}" filter.`
                : filter === 'pending'
                  ? 'All guest messages have been reviewed and moderated.'
                  : `No messages currently marked as ${filter}.`
            }
          />
        ) : (
          <div className="divide-y divide-[#EFEFEA]">
            {filteredMessages.map((msg) => {
              const classification = msg.classification || 'NORMAL';
              const isSpotlight = classification === 'COUPLE_SELECTED';
              const isSpecialGuest = classification === 'SPECIAL_GUEST';
              const isAiSuggested = classification === 'AI_SUGGESTED';

              return (
                <div 
                  key={msg.id}
                  className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                    isSpotlight 
                      ? 'bg-amber-50/40 border-l-4 border-l-amber-500' 
                      : isSpecialGuest 
                        ? 'bg-emerald-50/30 border-l-4 border-l-emerald-600'
                        : isAiSuggested
                          ? 'bg-purple-50/30 border-l-4 border-l-purple-400'
                          : msg.is_pinned 
                            ? 'bg-blue-50/20 border-l-4 border-l-blue-400'
                            : 'hover:bg-[#FAF9F7]/50'
                  }`}
                >
                  {/* Left Column: Author, Metadata & Content */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#252525] text-xs sm:text-sm">{msg.name}</span>
                      
                      {/* Classification Badge */}
                      {isSpotlight && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-mono font-medium">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-600" />
                          COUPLE SPOTLIGHT
                        </span>
                      )}
                      {isSpecialGuest && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-mono font-medium">
                          <Crown className="w-3 h-3 text-emerald-700" />
                          SPECIAL GUEST {msg.guest_category ? `(${msg.guest_category})` : ''}
                        </span>
                      )}
                      {isAiSuggested && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 border border-purple-300 text-purple-900 text-[10px] font-mono font-medium">
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          AI SUGGESTED
                        </span>
                      )}
                      {classification === 'NORMAL' && (
                        <span className="text-[10px] font-mono text-[#888888] bg-[#F5F5F0] px-1.5 py-0.5 rounded">
                          NORMAL ROTATION
                        </span>
                      )}

                      {/* Pinned Tag */}
                      {msg.is_pinned && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-mono">
                          <Pin className="w-2.5 h-2.5 fill-blue-600 text-blue-700" />
                          PINNED
                        </span>
                      )}

                      {/* Explicit Wish Category */}
                      {msg.wish_category && msg.wish_category !== 'normal' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 text-[10px] font-mono uppercase">
                          {msg.wish_category}
                        </span>
                      )}

                      <span className="text-[#B0ADA8]">·</span>
                      <span className="text-[#777777] font-mono tabular-nums text-[11px]">
                        {new Date(msg.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>

                    {/* Message Body */}
                    <p className="text-xs sm:text-sm text-[#444444] leading-relaxed italic font-serif">
                      "{msg.message}"
                    </p>

                    {/* AI Highlight Reason (if present) */}
                    {msg.ai_highlight_reason && (
                      <div className="flex items-center gap-1.5 text-[11px] text-purple-900 bg-purple-50/80 px-2.5 py-1 rounded border border-purple-200/80">
                        <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                        <span className="font-sans">Curator Insight: {msg.ai_highlight_reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Highlight, Pin, Preview & Moderation Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap">
                    {/* Wall Preview Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewMessage(msg)}
                      title="Preview this message on reception screen"
                      leftIcon={<Eye className="w-3.5 h-3.5 text-[#777777]" />}
                      className="!h-8 !px-2.5 !text-xs"
                    >
                      Wall Preview
                    </Button>

                    {/* Priority / Classification Selector */}
                    {filter === 'approved' && (
                      <div className="flex items-center bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg p-0.5">
                        {/* Spotlight Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(msg)}
                          title={msg.is_featured ? 'Remove from Featured Spotlight' : 'Promote to Couple Spotlight'}
                          className={`p-1.5 rounded transition-colors flex items-center gap-1 text-xs ${
                            msg.is_featured
                              ? 'bg-amber-100 text-amber-900 font-semibold'
                              : 'text-[#777777] hover:text-[#252525]'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${msg.is_featured ? 'fill-amber-500 text-amber-600' : ''}`} />
                          <span className="text-[11px] hidden sm:inline">
                            {msg.is_featured ? 'Spotlight' : 'Spotlight'}
                          </span>
                        </button>

                        {/* Pin Toggle */}
                        <button
                          type="button"
                          onClick={() => handleTogglePinned(msg)}
                          title={msg.is_pinned ? 'Unpin message' : 'Pin message for frequent rotation'}
                          className={`p-1.5 rounded transition-colors ${
                            msg.is_pinned
                              ? 'bg-blue-100 text-blue-900'
                              : 'text-[#777777] hover:text-[#252525]'
                          }`}
                        >
                          <Pin className={`w-3.5 h-3.5 ${msg.is_pinned ? 'fill-blue-600 text-blue-700' : ''}`} />
                        </button>

                        {/* Classification Dropdown */}
                        <select
                          value={msg.classification || 'NORMAL'}
                          onChange={(e) => handleChangeClassification(msg, e.target.value as MessageClassification)}
                          className="text-[11px] bg-transparent border-0 px-2 py-1 text-[#252525] font-medium focus:outline-none cursor-pointer"
                        >
                          <option value="NORMAL">Normal Priority</option>
                          <option value="SPECIAL_GUEST">👑 VIP Guest</option>
                          <option value="AI_SUGGESTED">✨ AI Suggested</option>
                          <option value="COUPLE_SELECTED">⭐ Couple Spotlight</option>
                        </select>
                      </div>
                    )}

                    {/* Approve / Decline Actions */}
                    {filter !== 'approved' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStatusUpdate(msg.id, 'approved')}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        className="!h-8"
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
                        className="!h-8"
                      >
                        Decline
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Suggestions Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-[#E8E8E5] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#E8E8E5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#252525]">AI Curated Wedding Highlights</h3>
                  <p className="text-xs text-[#777777]">Meaningful blessings, memories, and heartfelt messages discovered</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAiModal(false)}
                className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {aiSuggestions.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#777777] space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-medium text-[#252525]">All recommended highlights have been applied!</p>
                  <p>You can run curator analysis anytime as new guest messages arrive.</p>
                </div>
              ) : (
                aiSuggestions.map((sug) => {
                  const targetMsg = messages.find(m => m.id === sug.id);
                  if (!targetMsg) return null;

                  return (
                    <div key={sug.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#252525]">{targetMsg.name}</span>
                        <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          Recommended Highlight
                        </span>
                      </div>
                      <p className="text-xs text-[#444444] font-serif italic">"{targetMsg.message}"</p>
                      <div className="text-[11px] text-amber-900 bg-white/80 p-2 rounded border border-amber-200/60 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span><strong>Why AI Recommends It:</strong> {sug.reason}</span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyAiSuggestion(sug, 'AI_SUGGESTED')}
                          className="!text-xs"
                        >
                          Mark as AI Suggested
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApplyAiSuggestion(sug, 'COUPLE_SELECTED')}
                          leftIcon={<Star className="w-3.5 h-3.5 fill-current" />}
                          className="!text-xs !bg-amber-700 hover:!bg-amber-800"
                        >
                          Promote to Couple Spotlight
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-[#FAF9F7] border-t border-[#E8E8E5] flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Wall Preview Modal */}
      {previewMessage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] rounded-2xl max-w-2xl w-full border border-white/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-white/80">
                  Live Ballroom Danmaku &amp; Spotlight Preview
                </span>
              </div>
              <button 
                onClick={() => setPreviewMessage(null)}
                className="p-1 text-white/60 hover:text-white rounded"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className={`p-8 min-h-[340px] flex flex-col items-center justify-center gap-6 ${resolvedTheme.colors.background} relative overflow-hidden`}>
              {/* Floating Danmaku Pill Representation */}
              <div className="w-full flex flex-col items-center gap-2">
                <span className={`text-[10px] font-mono uppercase tracking-widest ${resolvedTheme.colors.subtleText}`}>
                  Live Ballroom Stream Appearance
                </span>
                <div className="max-w-full overflow-x-auto py-1 flex flex-wrap items-center justify-center gap-4">
                  <DanmakuPillCard
                    message={previewMessage}
                    theme={resolvedTheme}
                    config={resolvedPreviewConfig}
                    orientation={
                      resolvedPreviewConfig.danmakuDirectionMode === 'single' &&
                      (resolvedPreviewConfig.danmakuDirection === 'ttb' ||
                        resolvedPreviewConfig.danmakuDirection === 'btt')
                        ? 'vertical'
                        : 'horizontal'
                    }
                  />
                </div>
              </div>

              {/* Centered Spotlight Representation when eligible */}
              {(previewMessage.classification === 'COUPLE_SELECTED' || previewMessage.is_featured || previewMessage.is_pinned) && (
                <div className="w-full max-w-md pt-4 border-t border-current/10">
                  <div className="rounded-2xl p-6 text-center shadow-2xl border border-[#C9A24D]/55 bg-[#FFFDF8] text-[#1F1A12]">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase text-[#A67C2E] mb-2">
                      <Star className="w-3 h-3 fill-current" />
                      Couple&apos;s Spotlight Takeover ({resolveDisplayConfig(displayConfig).spotlightDuration}s)
                    </div>
                    <p className={`text-base ${resolvedTheme.fontHeading} italic text-gray-900 leading-relaxed mb-2`}>
                      &ldquo;{previewMessage.message}&rdquo;
                    </p>
                    <div className="text-xs font-medium text-gray-700">
                      — {previewMessage.name}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#141414] border-t border-white/10 flex items-center justify-between text-xs text-white/70">
              <span>Theme: <strong className="text-white">{resolvedTheme.name}</strong></span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMessage(null)}
                className="!text-white !border-white/20 hover:!bg-white/10"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Danmaku & Display Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-[#E8E8E5] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 sm:p-6 border-b border-[#E8E8E5] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F7] border border-[#E8E8E5] flex items-center justify-center text-[#8B806F]">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#252525]">Luxury Wedding Danmaku &amp; Display Settings</h3>
                  <p className="text-xs text-[#777777]">Configure 4-direction stream mode, density presets, spotlight duration, and live preview</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 text-xs overflow-y-auto flex-1">
              {/* Live Animated Simulated Preview Stage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] font-semibold">
                      LIVE 4-DIRECTION STREAM PREVIEW
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF9F7] border border-[#E8E8E5] text-[#666666]">
                      Simulated Wishes Only
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewPaused((p) => !p)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E8E8E5] bg-[#FAF9F7] hover:bg-[#F1EFEA] text-[11px] font-medium text-[#252525]"
                  >
                    {isPreviewPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {isPreviewPaused ? 'Resume Preview' : 'Pause Preview'}
                  </button>
                </div>

                <div
                  className={`relative w-full h-52 sm:h-60 rounded-xl border border-[#E8E8E5] overflow-hidden ${resolvedTheme.colors.background}`}
                >
                  <DanmakuStage
                    messages={SIMULATED_PREVIEW_MESSAGES}
                    liveSignalCount={0}
                    latestLiveMessage={null}
                    theme={resolvedTheme}
                    displayConfig={{
                      ...resolvedPreviewConfig,
                      danmakuFontSize: 'sm',
                    }}
                    isPaused={isPreviewPaused}
                  />
                  <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono opacity-65">
                    <span className={resolvedTheme.colors.subtleText}>
                      {resolvedPreviewConfig.danmakuDirectionMode === 'mixed'
                        ? `Mixed Mode (${resolvedPreviewConfig.danmakuDirections.length} Directions)`
                        : `Single: ${DANMAKU_DIRECTION_META[resolvedPreviewConfig.danmakuDirection].label}`}
                    </span>
                    <span className={resolvedTheme.colors.subtleText}>
                      {DANMAKU_DENSITY_PRESETS[resolvedPreviewConfig.danmakuDensity].label} Preset
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Density Presets */}
              <div className="space-y-2.5 pt-3 border-t border-[#E8E8E5]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] font-semibold">
                    DANMAKU DENSITY PRESET
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-[#252525]">
                    <input
                      type="checkbox"
                      checked={resolvedPreviewConfig.danmakuEnabled}
                      onChange={(e) => updateDisplayConfigSynced({ danmakuEnabled: e.target.checked })}
                      className="rounded border-gray-300 text-[#252525] focus:ring-[#8B806F]"
                    />
                    Enable Live Danmaku Stream
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['relaxed', 'balanced', 'celebration'] as DanmakuDensity[]).map((presetKey) => {
                    const preset = DANMAKU_DENSITY_PRESETS[presetKey];
                    const active = resolvedPreviewConfig.danmakuDensity === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() =>
                          updateDisplayConfigSynced({
                            danmakuDensity: presetKey,
                            danmaku: {
                              ...resolvedPreviewConfig.danmaku,
                              preset: presetKey,
                            },
                          })
                        }
                        className={`text-left p-3 rounded-xl border transition-all ${
                          active
                            ? 'bg-[#252525] text-white border-[#252525] shadow-sm'
                            : 'bg-[#FAF9F7] text-[#252525] border-[#E8E8E5] hover:border-[#8B806F]'
                        }`}
                      >
                        <div className="font-semibold text-xs">{preset.label}</div>
                        <div className={`text-[10px] mt-0.5 leading-snug ${active ? 'text-white/75' : 'text-[#777777]'}`}>
                          {preset.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Danmaku Direction Mode & 4-Direction Controls */}
              <div className="space-y-3 pt-3 border-t border-[#E8E8E5]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] font-semibold block">
                      DANMAKU DIRECTION MODE
                    </span>
                    <p className="text-[11px] text-[#777777] mt-0.5">
                      Choose one dedicated glide direction or blend horizontal and vertical streams
                    </p>
                  </div>

                  <div className="inline-flex rounded-lg bg-[#FAF9F7] border border-[#E8E8E5] p-0.5 self-start">
                    {(['single', 'mixed'] as DanmakuDirectionMode[]).map((mode) => {
                      const active = resolvedPreviewConfig.danmakuDirectionMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            const nextDirs =
                              mode === 'mixed'
                                ? ALL_DANMAKU_DIRECTIONS
                                : [resolvedPreviewConfig.danmakuDirection];
                            updateDisplayConfigSynced({
                              danmakuDirectionMode: mode,
                              danmakuDirections: nextDirs,
                              danmaku: {
                                directionMode: mode,
                                directions: nextDirs.map(directionToSlug),
                                preset: resolvedPreviewConfig.danmakuDensity,
                              },
                            });
                          }}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                            active
                              ? 'bg-[#252525] text-white shadow-xs'
                              : 'text-[#555555] hover:text-[#252525]'
                          }`}
                        >
                          {mode === 'mixed' && <Shuffle className="w-3 h-3" />}
                          {mode === 'single' ? 'Single Direction' : 'Mixed Directions'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {resolvedPreviewConfig.danmakuDirectionMode === 'single' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ALL_DANMAKU_DIRECTIONS.map((dir) => {
                      const meta = DANMAKU_DIRECTION_META[dir];
                      const active = resolvedPreviewConfig.danmakuDirection === dir;
                      const DirIcon =
                        dir === 'rtl'
                          ? ArrowLeft
                          : dir === 'ltr'
                            ? ArrowRight
                            : dir === 'ttb'
                              ? ArrowDown
                              : ArrowUp;
                      return (
                        <button
                          key={dir}
                          type="button"
                          onClick={() =>
                            updateDisplayConfigSynced({
                              danmakuDirectionMode: 'single',
                              danmakuDirection: dir,
                              danmakuDirections: [dir],
                              danmaku: {
                                directionMode: 'single',
                                directions: [meta.slug],
                                preset: resolvedPreviewConfig.danmakuDensity,
                              },
                            })
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                            active
                              ? 'bg-[#252525] text-white border-[#252525] shadow-xs'
                              : 'bg-[#FAF9F7] text-[#252525] border-[#E8E8E5] hover:border-[#8B806F]'
                          }`}
                        >
                          <DirIcon className="w-4 h-4 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-xs truncate">{meta.label}</div>
                            <div className={`text-[10px] ${active ? 'text-white/70' : 'text-[#777777]'}`}>
                              {meta.axis === 'horizontal' ? 'Horizontal lane' : 'Vertical card'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E8E5] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-[#252525]">
                        Active Directions in Mixed Stream
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateDisplayConfigSynced({
                            danmakuDirectionMode: 'mixed',
                            danmakuDirections: [...ALL_DANMAKU_DIRECTIONS],
                            danmaku: {
                              directionMode: 'mixed',
                              directions: ALL_DANMAKU_DIRECTIONS.map(directionToSlug),
                              preset: resolvedPreviewConfig.danmakuDensity,
                            },
                          })
                        }
                        className="text-[11px] text-[#8B806F] hover:text-[#252525] font-medium"
                      >
                        Enable All 4
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ALL_DANMAKU_DIRECTIONS.map((dir) => {
                        const meta = DANMAKU_DIRECTION_META[dir];
                        const enabled = resolvedPreviewConfig.danmakuDirections.includes(dir);
                        const DirIcon =
                          dir === 'rtl'
                            ? ArrowLeft
                            : dir === 'ltr'
                              ? ArrowRight
                              : dir === 'ttb'
                                ? ArrowDown
                                : ArrowUp;
                        return (
                          <button
                            key={dir}
                            type="button"
                            onClick={() => {
                              const current = resolvedPreviewConfig.danmakuDirections;
                              let nextDirs: DanmakuDirection[];
                              if (enabled) {
                                // Keep at least 1 direction active
                                if (current.length <= 1) return;
                                nextDirs = current.filter((d) => d !== dir);
                              } else {
                                nextDirs = ALL_DANMAKU_DIRECTIONS.filter(
                                  (d) => d === dir || current.includes(d)
                                );
                              }
                              updateDisplayConfigSynced({
                                danmakuDirectionMode: 'mixed',
                                danmakuDirections: nextDirs,
                                danmakuDirection: nextDirs[0] || 'rtl',
                                danmaku: {
                                  directionMode: 'mixed',
                                  directions: nextDirs.map(directionToSlug),
                                  preset: resolvedPreviewConfig.danmakuDensity,
                                },
                              });
                            }}
                            className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                              enabled
                                ? 'bg-white text-[#252525] border-[#252525] shadow-xs'
                                : 'bg-white/50 text-[#888888] border-[#E8E8E5] opacity-70 hover:opacity-100'
                            }`}
                          >
                            <DirIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-medium truncate">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-[#777777]">
                      Horizontal pills and horizontal-text vertical cards flow together with collision and intersection protection.
                    </p>
                  </div>
                )}

                {/* 3. Track Geometry, Speed & Typography */}
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] font-semibold block pt-2">
                  STREAM MOTION &amp; TYPOGRAPHY
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1.5">
                    <label className="text-[11px] font-medium text-[#252525] block">Tracks &amp; Columns</label>
                    <select
                      value={String(resolvedPreviewConfig.danmakuTracks)}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDisplayConfigSynced({
                          danmakuTracks: val === 'auto' ? 'auto' : parseInt(val, 10),
                        });
                      }}
                      className="w-full bg-white border border-[#D5D5D0] rounded px-2.5 py-1.5 text-xs font-medium text-[#252525]"
                    >
                      <option value="auto">Auto (Responsive to Screen Dimensions)</option>
                      <option value="4">4 Spacious Lanes</option>
                      <option value="6">6 Balanced Lanes</option>
                      <option value="8">8 Wide Ballroom Lanes</option>
                      <option value="10">10 Large LED Wall Lanes</option>
                    </select>
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1.5">
                    <div className="flex justify-between">
                      <label className="text-[11px] font-medium text-[#252525]">Scroll Speed</label>
                      <span className="font-mono text-[11px] text-[#777777]">{resolvedPreviewConfig.danmakuSpeed} px/s</span>
                    </div>
                    <input
                      type="range"
                      min={65}
                      max={185}
                      step={5}
                      value={resolvedPreviewConfig.danmakuSpeed}
                      onChange={(e) => updateDisplayConfigSynced({ danmakuSpeed: parseInt(e.target.value, 10) })}
                      className="w-full accent-[#252525]"
                    />
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1.5">
                    <div className="flex justify-between">
                      <label className="text-[11px] font-medium text-[#252525]">Normal Pill Opacity</label>
                      <span className="font-mono text-[11px] text-[#777777]">{Math.round(resolvedPreviewConfig.danmakuOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={55}
                      max={100}
                      step={5}
                      value={Math.round(resolvedPreviewConfig.danmakuOpacity * 100)}
                      onChange={(e) => updateDisplayConfigSynced({ danmakuOpacity: parseInt(e.target.value, 10) / 100 })}
                      className="w-full accent-[#252525]"
                    />
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1.5">
                    <label className="text-[11px] font-medium text-[#252525] block">Font Size</label>
                    <select
                      value={resolvedPreviewConfig.danmakuFontSize}
                      onChange={(e) => updateDisplayConfigSynced({ danmakuFontSize: e.target.value as DanmakuFontSize })}
                      className="w-full bg-white border border-[#D5D5D0] rounded px-2.5 py-1.5 text-xs font-medium text-[#252525]"
                    >
                      <option value="sm">Compact Editorial</option>
                      <option value="md">Medium Ballroom (Recommended)</option>
                      <option value="lg">Large Projector Scale</option>
                    </select>
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-medium text-[#252525] block">Special Wish Styling</label>
                    <select
                      value={resolvedPreviewConfig.danmakuSpecialStyle}
                      onChange={(e) => updateDisplayConfigSynced({ danmakuSpecialStyle: e.target.value as DanmakuSpecialStyle })}
                      className="w-full bg-white border border-[#D5D5D0] rounded px-2.5 py-1.5 text-xs font-medium text-[#252525]"
                    >
                      <option value="champagne-gold">Champagne Gold Serif Accent</option>
                      <option value="theme-accent">Event Theme Accent</option>
                      <option value="minimal-editorial">Minimal Editorial Border</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Spotlight, Celebration Effects & Visibility */}
              <div className="space-y-3 pt-3 border-t border-[#E8E8E5]">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] font-semibold block">
                  COUPLE SPOTLIGHT &amp; CELEBRATION EFFECTS
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 space-y-1.5">
                    <label className="text-[11px] font-medium text-amber-900 block">
                      Centered Spotlight Duration (5–12s)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={12}
                      value={displayConfig.spotlightDuration ?? 7}
                      onChange={(e) =>
                        setDisplayConfig({
                          ...displayConfig,
                          spotlightDuration: Math.max(4, Math.min(15, parseInt(e.target.value, 10) || 7)),
                        })
                      }
                      className="w-full bg-white border border-amber-300 rounded px-2.5 py-1 text-center font-mono text-sm font-semibold text-amber-900"
                    />
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1.5">
                    <label className="text-[11px] font-medium text-[#252525] block">Animation Intensity</label>
                    <select
                      value={displayConfig.animationIntensity || 'moderate'}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, animationIntensity: e.target.value as AnimationIntensity })}
                      className="w-full bg-white border border-[#D5D5D0] rounded px-2.5 py-1.5 text-xs font-medium text-[#252525]"
                    >
                      <option value="subtle">Subtle (Minimal Particles)</option>
                      <option value="moderate">Moderate (Floating Hearts on Live Wishes)</option>
                      <option value="lively">Lively Celebration Accents</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-[#252525]">
                    <input
                      type="checkbox"
                      checked={displayConfig.showSenderNames ?? true}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, showSenderNames: e.target.checked })}
                      className="rounded border-gray-300 text-[#252525]"
                    />
                    Show Sender Names on Danmaku
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-[#252525]">
                    <input
                      type="checkbox"
                      checked={displayConfig.showActivityStats ?? true}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, showActivityStats: e.target.checked })}
                      className="rounded border-gray-300 text-[#252525]"
                    />
                    Show Wish Counter Header
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <div>
                    <div className="font-medium text-[#252525]">Spotlight Transition Style</div>
                    <div className="text-[11px] text-[#777777]">Entrance effect when showcasing Couple&apos;s Spotlight wishes</div>
                  </div>
                  <select
                    value={displayConfig.spotlightAnimation}
                    onChange={(e) => setDisplayConfig({ ...displayConfig, spotlightAnimation: e.target.value as any })}
                    className="bg-white border border-[#D5D5D0] rounded px-3 py-1.5 text-xs font-medium text-[#252525]"
                  >
                    <option value="elegant-spotlight">Elegant Editorial Halo</option>
                    <option value="fade-scale">Smooth Zoom &amp; Fade</option>
                    <option value="cinematic-glide">Cinematic Glide</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#FAF9F7] border-t border-[#E8E8E5] flex items-center justify-between shrink-0">
              {configSuccess ? (
                <div className="text-xs text-emerald-800 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Danmaku &amp; display settings saved!</span>
                </div>
              ) : (
                <span className="text-[11px] text-[#777777]">Settings apply live to active ballroom screens</span>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfigModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isSavingConfig}
                  onClick={handleSaveDisplayConfig}
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
