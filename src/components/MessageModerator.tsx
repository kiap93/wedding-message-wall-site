import React, { useState, useEffect } from 'react';
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
  Info
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
import Tabs from '../design-system/components/Tabs';
import Button from '../design-system/components/Button';
import Badge from '../design-system/components/Badge';
import EmptyState from '../design-system/components/EmptyState';
import { resolveEventTheme } from '../lib/eventTheme';
import { getSupabase } from '../lib/supabase';

interface MessageModeratorProps {
  projectId: string;
  themeId?: string;
  initialDisplayConfig?: MessageDisplayConfig;
}

export default function MessageModerator({ 
  projectId, 
  themeId = 'minimal_luxury',
  initialDisplayConfig 
}: MessageModeratorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');

  // AI Highlights state
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ id: string; classification: MessageClassification; reason: string }>>([]);
  const [showAiModal, setShowAiModal] = useState(false);

  // Display Preview modal state
  const [previewMessage, setPreviewMessage] = useState<Message | null>(null);

  // Display Configuration modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [displayConfig, setDisplayConfig] = useState<MessageDisplayConfig>(
    initialDisplayConfig || DEFAULT_MESSAGE_DISPLAY_CONFIG
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

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
    try {
      await updateMessageStatus(messageId, status);
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (err) {
      alert('Failed to update message status');
    }
  };

  const handleToggleFeatured = async (msg: Message) => {
    const nextFeatured = !msg.is_featured;
    // When marking as featured, elevate to COUPLE_SELECTED if previously normal
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
    } catch (err) {
      alert('Failed to update featured status');
    }
  };

  const handleTogglePinned = async (msg: Message) => {
    const nextPinned = !msg.is_pinned;
    try {
      await updateMessageHighlight(msg.id, { is_pinned: nextPinned });
      setMessages(messages.map(m => m.id === msg.id ? { ...m, is_pinned: nextPinned } : m));
    } catch (err) {
      alert('Failed to update pinned status');
    }
  };

  const handleChangeClassification = async (msg: Message, classification: MessageClassification) => {
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
    } catch (err) {
      alert('Failed to change message classification');
    }
  };

  const handleRunAiAnalysis = async () => {
    setIsAnalyzingAI(true);
    try {
      const res = await analyzeMessagesWithAI(projectId);
      setAiSuggestions(res.suggestions || []);
      setShowAiModal(true);
    } catch (err: any) {
      alert('AI highlight analysis error: ' + (err.message || 'Please ensure messages are approved.'));
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleApplyAiSuggestion = async (suggestion: { id: string; classification: MessageClassification; reason: string }, targetClass: MessageClassification = 'AI_SUGGESTED') => {
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
      // Remove from pending suggestions list
      setAiSuggestions(aiSuggestions.filter(s => s.id !== suggestion.id));
    } catch (err) {
      alert('Failed to apply recommendation');
    }
  };

  const handleSaveDisplayConfig = async () => {
    setIsSavingConfig(true);
    try {
      await updateMessageDisplayConfig(projectId, displayConfig);
      setConfigSuccess(true);
      setTimeout(() => {
        setConfigSuccess(false);
        setShowConfigModal(false);
      }, 1000);
    } catch (err: any) {
      alert('Failed to save display config: ' + err.message);
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

          {/* Display Rotation Settings Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            leftIcon={<Sliders className="w-3.5 h-3.5 text-[#8B806F]" />}
          >
            Display Rotation & Timings
          </Button>

          <Tabs
            variant="segmented"
            items={tabs}
            activeId={filter}
            onChange={(id) => setFilter(id as any)}
          />
        </div>
      </div>

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
          <div className="bg-[#1A1A1A] rounded-2xl max-w-xl w-full border border-white/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-white/80">
                  Ballroom Projector Wall Simulation
                </span>
              </div>
              <button 
                onClick={() => setPreviewMessage(null)}
                className="p-1 text-white/60 hover:text-white rounded"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className={`p-8 min-h-[340px] flex items-center justify-center ${resolvedTheme.colors.background} relative overflow-hidden`}>
              {/* Card Rendering Simulation */}
              <div className="w-full max-w-md">
                {previewMessage.classification === 'COUPLE_SELECTED' ? (
                  /* Spotlight Presentation Simulation */
                  <div className="relative rounded-2xl p-7 text-center shadow-2xl border-2 border-amber-300 bg-linear-to-b from-white to-[#FDFBF7] ring-4 ring-amber-300/20 transform scale-105 transition-all">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white font-mono text-[10px] tracking-widest uppercase mb-3 shadow-xs">
                      <Star className="w-3 h-3 fill-white" />
                      COUPLE'S SPOTLIGHT MEMORY
                    </div>
                    <h3 className={`text-xl ${resolvedTheme.fontHeading} text-gray-900 font-semibold mb-2`}>
                      {previewMessage.name}
                    </h3>
                    <p className="text-base font-serif italic text-gray-800 leading-relaxed mb-4">
                      "{previewMessage.message}"
                    </p>
                    <div className="text-[10px] font-mono text-amber-800/60 uppercase border-t border-amber-200/60 pt-2">
                      Spotlight Duration: {displayConfig.coupleSelectedDuration}s · Priority Level 1
                    </div>
                  </div>
                ) : previewMessage.classification === 'SPECIAL_GUEST' ? (
                  /* Special Guest Card Simulation */
                  <div className="relative rounded-xl p-6 text-center shadow-lg border-2 border-emerald-600/40 bg-white ring-2 ring-emerald-600/10">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[10px] mb-2 font-medium">
                      <Crown className="w-3 h-3 text-emerald-700" />
                      SPECIAL GUEST {previewMessage.guest_category ? `• ${previewMessage.guest_category}` : ''}
                    </div>
                    <h3 className={`text-lg ${resolvedTheme.fontHeading} text-gray-900 font-semibold mb-2`}>
                      {previewMessage.name}
                    </h3>
                    <p className="text-sm font-serif italic text-gray-800 leading-relaxed mb-3">
                      "{previewMessage.message}"
                    </p>
                    <div className="text-[10px] font-mono text-gray-400 border-t border-gray-100 pt-2">
                      Display Duration: {displayConfig.specialGuestDuration}s · Priority Level 2
                    </div>
                  </div>
                ) : (
                  /* Normal Card Simulation */
                  <div className="relative rounded-xl p-6 text-center shadow-md border border-gray-200 bg-white">
                    <h3 className={`text-base ${resolvedTheme.fontHeading} text-gray-900 font-semibold mb-2`}>
                      {previewMessage.name}
                    </h3>
                    <p className="text-xs sm:text-sm font-serif italic text-gray-700 leading-relaxed mb-3">
                      "{previewMessage.message}"
                    </p>
                    <div className="text-[10px] font-mono text-gray-400 border-t border-gray-100 pt-2">
                      Standard Rotation: {displayConfig.normalDuration}s · Priority Level 4
                    </div>
                  </div>
                )}
              </div>
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

      {/* Display Configuration & Timing Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E8E8E5] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#E8E8E5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F7] border border-[#E8E8E5] flex items-center justify-center text-[#8B806F]">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#252525]">Display Wall Timing & Rotation</h3>
                  <p className="text-xs text-[#777777]">Tune durations, spotlight frequency, and animations</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-[#777777] hover:text-[#252525] rounded transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Duration Settings */}
              <div className="space-y-4">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] font-semibold">
                  MESSAGE DISPLAY DURATIONS
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E8E8E5] space-y-1.5">
                    <label className="text-[11px] font-medium text-[#252525] block">Normal (sec)</label>
                    <input
                      type="number"
                      min={4}
                      max={30}
                      value={displayConfig.normalDuration}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, normalDuration: parseInt(e.target.value, 10) || 8 })}
                      className="w-full bg-white border border-[#D5D5D0] rounded px-2 py-1 text-center font-mono text-sm font-semibold text-[#252525]"
                    />
                    <span className="text-[10px] text-[#777777] block text-center">Standard cards</span>
                  </div>

                  <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-1.5">
                    <label className="text-[11px] font-medium text-emerald-900 block">VIP Guest (sec)</label>
                    <input
                      type="number"
                      min={6}
                      max={45}
                      value={displayConfig.specialGuestDuration}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, specialGuestDuration: parseInt(e.target.value, 10) || 12 })}
                      className="w-full bg-white border border-emerald-300 rounded px-2 py-1 text-center font-mono text-sm font-semibold text-emerald-900"
                    />
                    <span className="text-[10px] text-emerald-800 block text-center">Special guests</span>
                  </div>

                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 space-y-1.5">
                    <label className="text-[11px] font-medium text-amber-900 block">Spotlight (sec)</label>
                    <input
                      type="number"
                      min={8}
                      max={60}
                      value={displayConfig.coupleSelectedDuration}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, coupleSelectedDuration: parseInt(e.target.value, 10) || 16 })}
                      className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-center font-mono text-sm font-semibold text-amber-900"
                    />
                    <span className="text-[10px] text-amber-800 block text-center">Couple selected</span>
                  </div>
                </div>
              </div>

              {/* Rotation Frequency & Anti-Starvation */}
              <div className="space-y-3 pt-2 border-t border-[#E8E8E5]">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B806F] font-semibold">
                  ROTATION FREQUENCY & FAIRNESS
                </span>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[#252525]">Featured Rotation Frequency</div>
                      <div className="text-[11px] text-[#777777]">Insert a spotlight message every N standard cards</div>
                    </div>
                    <select
                      value={displayConfig.featuredFrequency}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, featuredFrequency: parseInt(e.target.value, 10) || 3 })}
                      className="bg-white border border-[#D5D5D0] rounded px-3 py-1 font-mono text-xs font-semibold text-[#252525]"
                    >
                      <option value={2}>Every 2 messages</option>
                      <option value={3}>Every 3 messages (Recommended)</option>
                      <option value={4}>Every 4 messages</option>
                      <option value={5}>Every 5 messages</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[#252525]">Max Consecutive Featured Messages</div>
                      <div className="text-[11px] text-[#777777]">Prevents back-to-back spotlight takeovers</div>
                    </div>
                    <select
                      value={displayConfig.maxConsecutiveFeatured}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, maxConsecutiveFeatured: parseInt(e.target.value, 10) || 1 })}
                      className="bg-white border border-[#D5D5D0] rounded px-3 py-1 font-mono text-xs font-semibold text-[#252525]"
                    >
                      <option value={1}>1 featured message</option>
                      <option value={2}>Up to 2 consecutive</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-[#252525]">Spotlight Animation Style</div>
                      <div className="text-[11px] text-[#777777]">Visual transition effect for Couple Spotlight cards</div>
                    </div>
                    <select
                      value={displayConfig.spotlightAnimation}
                      onChange={(e) => setDisplayConfig({ ...displayConfig, spotlightAnimation: e.target.value as any })}
                      className="bg-white border border-[#D5D5D0] rounded px-3 py-1 text-xs font-medium text-[#252525]"
                    >
                      <option value="elegant-spotlight">✨ Elegant Spotlight (Soft Golden Halo)</option>
                      <option value="fade-scale">🔍 Smooth Zoom & Fade</option>
                      <option value="cinematic-glide">🎬 Cinematic Glide</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#FAF9F7] border-t border-[#E8E8E5] flex items-center justify-between">
              {configSuccess ? (
                <div className="text-xs text-emerald-800 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Display timing settings saved!</span>
                </div>
              ) : (
                <span className="text-[11px] text-[#777777]">Settings apply live to active screens</span>
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
